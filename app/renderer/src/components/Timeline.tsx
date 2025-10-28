/**
 * Timeline Component
 * @mem ref: design-spec, pr6-timeline
 * Bottom panel for timeline editing with trim handles
 * Single-track timeline with draggable in/out handles for trim editing
 */

import React, { useState, useRef, useEffect } from "react";
import "./Timeline.css";

interface Clip {
  id: string;
  path: string;
  filename: string;
  duration: number;
  width: number;
  height: number;
  inMs: number;
  outMs: number;
  thumbnailUrl?: string;
}

interface TimelineProps {
  clip: Clip | null;
  currentTime: number; // Current playback time in absolute milliseconds
  onUpdateTrim: (clipId: string, inMs: number, outMs: number) => void;
  onSeek: (timeMs: number) => void; // Seek to absolute time in milliseconds
}

const Timeline: React.FC<TimelineProps> = ({
  clip,
  currentTime,
  onUpdateTrim,
  onSeek,
}) => {
  const [zoom, setZoom] = useState(100);
  const [isDraggingIn, setIsDraggingIn] = useState(false);
  const [isDraggingOut, setIsDraggingOut] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartValue, setDragStartValue] = useState(0);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  // Calculate pixel width per second based on zoom
  // At 100% zoom: 10 pixels per second
  // At 200% zoom: 20 pixels per second
  // At 50% zoom: 5 pixels per second
  const BASE_PIXELS_PER_SECOND = 10;
  const pixelsPerSecond = (zoom / 100) * BASE_PIXELS_PER_SECOND;
  const pixelsPerMs = pixelsPerSecond / 1000;

  // Handle zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 400));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 25));

  // Format time in MM:SS:MS
  const formatTimecode = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`;
  };

  // Snapping threshold in milliseconds
  const SNAP_THRESHOLD_MS = 50;

  // Handle in-handle drag start
  const handleInHandleMouseDown = (e: React.MouseEvent) => {
    if (!clip) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingIn(true);
    setDragStartX(e.clientX);
    setDragStartValue(clip.inMs);
  };

  // Handle out-handle drag start
  const handleOutHandleMouseDown = (e: React.MouseEvent) => {
    if (!clip) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOut(true);
    setDragStartX(e.clientX);
    setDragStartValue(clip.outMs);
  };

  // Handle mouse move during drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!clip || (!isDraggingIn && !isDraggingOut)) return;

      const deltaX = e.clientX - dragStartX;
      const deltaMs = deltaX / pixelsPerMs;

      if (isDraggingIn) {
        const newInMs = Math.max(
          0,
          Math.min(dragStartValue + deltaMs, clip.outMs - 100)
        ); // min 100ms clip
        onUpdateTrim(clip.id, newInMs, clip.outMs);
      } else if (isDraggingOut) {
        const newOutMs = Math.max(
          clip.inMs + 100,
          Math.min(dragStartValue + deltaMs, clip.duration)
        ); // min 100ms clip
        onUpdateTrim(clip.id, clip.inMs, newOutMs);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingIn(false);
      setIsDraggingOut(false);
    };

    if (isDraggingIn || isDraggingOut) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [
    isDraggingIn,
    isDraggingOut,
    dragStartX,
    dragStartValue,
    clip,
    onUpdateTrim,
    pixelsPerMs,
  ]);

  // Calculate clip dimensions for rendering
  const getClipStyle = () => {
    if (!clip) return {};

    const clipWidth = clip.duration * pixelsPerMs;
    const trimmedStart = clip.inMs * pixelsPerMs;
    const trimmedWidth = (clip.outMs - clip.inMs) * pixelsPerMs;

    return {
      width: `${clipWidth}px`,
      trimmedStart,
      trimmedWidth,
    };
  };

  const clipStyle = clip ? getClipStyle() : null;

  // Calculate playhead position - always use current playback time
  const playheadPosition = clip ? currentTime * pixelsPerMs : 0;

  // Handle mouse down on timeline to start dragging playhead
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!clip || !trackRef.current) return;

    // Don't drag if clicking on trim handles
    const target = e.target as HTMLElement;
    if (target.closest(".timeline-trim-handle")) return;

    e.preventDefault();
    setIsDraggingPlayhead(true);

    const rect = trackRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const clickedTimeMs = mouseX / pixelsPerMs;
    const clampedTime = Math.max(0, Math.min(clickedTimeMs, clip.duration));

    onSeek(clampedTime);
  };

  // Handle mouse move during playhead drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingPlayhead || !clip || !trackRef.current) return;

      const rect = trackRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const hoverTimeMs = mouseX / pixelsPerMs;

      const clampedTime = Math.max(0, Math.min(hoverTimeMs, clip.duration));
      onSeek(clampedTime);
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
    };

    if (isDraggingPlayhead) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDraggingPlayhead, clip, pixelsPerMs, onSeek]);

  return (
    <div className="timeline">
      <div className="timeline-header">
        <button className="timeline-header-button">Track 1</button>
        <div className="timeline-zoom">
          <button className="zoom-button" onClick={handleZoomOut}>
            −
          </button>
          <span className="zoom-label">{zoom}%</span>
          <button className="zoom-button" onClick={handleZoomIn}>
            +
          </button>
        </div>
      </div>

      <div className="timeline-content">
        <div className="timeline-track-container">
          <div
            className="timeline-track"
            ref={trackRef}
            onMouseDown={handleMouseDown}
            style={{ cursor: "pointer" }}
          >
            {!clip ? (
              <div className="timeline-empty">
                <p className="timeline-empty-text">
                  Select a clip from Media Library to edit
                </p>
              </div>
            ) : (
              <>
                {/* Playhead line */}
                <div
                  className="timeline-playhead"
                  style={{ left: `${playheadPosition}px` }}
                />

                <div
                  className="timeline-clip-container"
                  style={{ width: clipStyle!.width }}
                >
                  {/* Full clip background (grayed out) */}
                  <div className="timeline-clip-full">
                    <span className="clip-filename">{clip.filename}</span>
                  </div>

                  {/* Active (trimmed) region */}
                  <div
                    className="timeline-clip-active"
                    style={{
                      left: `${clipStyle!.trimmedStart}px`,
                      width: `${clipStyle!.trimmedWidth}px`,
                    }}
                  >
                    {/* In handle (left) */}
                    <div
                      className={`timeline-trim-handle timeline-trim-handle-in ${
                        isDraggingIn ? "dragging" : ""
                      }`}
                      onMouseDown={handleInHandleMouseDown}
                    >
                      <div className="trim-handle-line" />
                      <div className="trim-handle-grip" />
                    </div>

                    {/* Out handle (right) */}
                    <div
                      className={`timeline-trim-handle timeline-trim-handle-out ${
                        isDraggingOut ? "dragging" : ""
                      }`}
                      onMouseDown={handleOutHandleMouseDown}
                    >
                      <div className="trim-handle-line" />
                      <div className="trim-handle-grip" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
