/**
 * Pro Timeline Component
 * @mem ref: pr14-timeline, multi-track-editing, pr16-text-overlays
 * Multi-track timeline with advanced editing capabilities and text overlays
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import type {
  Sequence,
  Clip as TimelineClip,
  Track,
  MediaInfo,
  Overlay,
} from "../../../shared/timelineTypes";
import * as timelineReducers from "../../../shared/timelineReducers";
import "./ProTimeline.css";

interface ProTimelineProps {
  sequence: Sequence;
  media: Record<string, MediaInfo>;
  playheadMs: number;
  onSequenceChange: (sequence: Sequence) => void;
  onSeek: (timeMs: number) => void;
  onMediaAdd?: (mediaId: string, mediaInfo: MediaInfo) => void;
  selectedOverlayId?: string | null;
  onSelectOverlay?: (overlayId: string | null) => void;
}

const ProTimeline: React.FC<ProTimelineProps> = ({
  sequence,
  media,
  playheadMs,
  onSequenceChange,
  onSeek,
  onMediaAdd,
  selectedOverlayId,
  onSelectOverlay,
}) => {
  const [zoom, setZoom] = useState(100); // 100% = 10px per second
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isDraggingClip, setIsDraggingClip] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartMs, setDragStartMs] = useState(0);
  const [dragClipId, setDragClipId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dropTrackId, setDropTrackId] = useState<string | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0); // Track scroll position for sticky playhead

  // Overlay drag/resize state
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);
  const [isResizingOverlay, setIsResizingOverlay] = useState(false);
  const [overlayDragType, setOverlayDragType] = useState<
    "move" | "resize-start" | "resize-end" | null
  >(null);
  const [dragOverlayId, setDragOverlayId] = useState<string | null>(null);
  const [dragOverlayStartMs, setDragOverlayStartMs] = useState(0);
  const [dragOverlayDurationMs, setDragOverlayDurationMs] = useState(0);

  // Clip trim state
  const [trimmingClip, setTrimmingClip] = useState<{
    clipId: string;
    edge: "in" | "out";
    startX: number;
    startValue: number;
  } | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const tracksRef = useRef<HTMLDivElement>(null);

  // Track scroll position for sticky playhead
  useEffect(() => {
    const handleScroll = () => {
      if (tracksRef.current) {
        setScrollLeft(tracksRef.current.scrollLeft);
      }
    };

    const tracksElement = tracksRef.current;
    if (tracksElement) {
      tracksElement.addEventListener("scroll", handleScroll);
      return () => tracksElement.removeEventListener("scroll", handleScroll);
    }
  }, []);

  // Calculate pixel width per second based on zoom
  const BASE_PIXELS_PER_SECOND = 10;
  const pixelsPerSecond = (zoom / 100) * BASE_PIXELS_PER_SECOND;
  const pixelsPerMs = pixelsPerSecond / 1000;

  // Handle zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 400));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 25));

  // Format time in MM:SS:FF (frames)
  const formatTimecode = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const frames = Math.floor((ms % 1000) / (1000 / sequence.fps));
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  };

  // Convert screen X to timeline milliseconds
  const screenXToMs = useCallback(
    (screenX: number): number => {
      if (!tracksRef.current) return 0;
      const rect = tracksRef.current.getBoundingClientRect();
      const TRACK_HEADER_WIDTH = 120; // Width of track header column
      const relativeX =
        screenX - rect.left - TRACK_HEADER_WIDTH + tracksRef.current.scrollLeft;
      return Math.max(0, relativeX / pixelsPerMs);
    },
    [pixelsPerMs]
  );

  // Handle playhead drag
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (isDraggingClip) return;
    const timeMs = screenXToMs(e.clientX);
    onSeek(timeMs);
  };

  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlayhead(true);
  };

  useEffect(() => {
    if (!isDraggingPlayhead) return;

    const handleMouseMove = (e: MouseEvent) => {
      const timeMs = screenXToMs(e.clientX);
      onSeek(timeMs);
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingPlayhead, screenXToMs, onSeek]);

  // Handle clip selection
  const handleClipClick = (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedClipId(clipId);
  };

  // Handle clip drag
  const handleClipMouseDown = (clip: TimelineClip, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingClip(true);
    setDragClipId(clip.id);
    setDragStartX(e.clientX);
    setDragStartMs(clip.startMs);
    setSelectedClipId(clip.id);
  };

  useEffect(() => {
    if (!isDraggingClip || !dragClipId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX;
      const deltaMs = deltaX / pixelsPerMs;
      let newStartMs = dragStartMs + deltaMs;

      // Apply snapping if enabled
      if (snapEnabled) {
        newStartMs = timelineReducers.applySnapping(
          newStartMs,
          sequence,
          playheadMs,
          100 // 100ms threshold
        );
      }

      // Move clip
      let result = timelineReducers.moveClip(
        sequence,
        dragClipId,
        newStartMs,
        { snap: false } // We already snapped above
      );

      if ("sequence" in result && result.sequence) {
        onSequenceChange(result.sequence);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingClip(false);
      setDragClipId(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDraggingClip,
    dragClipId,
    dragStartX,
    dragStartMs,
    pixelsPerMs,
    sequence,
    playheadMs,
    snapEnabled,
    onSequenceChange,
  ]);

  // Handle overlay drag and resize
  useEffect(() => {
    if (
      (!isDraggingOverlay && !isResizingOverlay) ||
      !dragOverlayId ||
      !overlayDragType
    )
      return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX;
      const deltaMs = deltaX / pixelsPerMs;

      const overlay = sequence.overlays?.find((o) => o.id === dragOverlayId);
      if (!overlay) return;

      let updates: Partial<Overlay> = {};

      if (overlayDragType === "move") {
        // Move overlay
        let newStartMs = dragOverlayStartMs + deltaMs;

        // Apply snapping if enabled
        if (snapEnabled) {
          newStartMs = timelineReducers.applySnapping(
            newStartMs,
            sequence,
            playheadMs,
            100
          );
        }

        newStartMs = Math.max(0, newStartMs);
        updates.startMs = newStartMs;
      } else if (overlayDragType === "resize-start") {
        // Resize from start (move start, adjust duration)
        let newStartMs = dragOverlayStartMs + deltaMs;
        newStartMs = Math.max(
          0,
          Math.min(newStartMs, dragOverlayStartMs + dragOverlayDurationMs - 100)
        );

        const newDurationMs =
          dragOverlayDurationMs - (newStartMs - dragOverlayStartMs);
        updates.startMs = newStartMs;
        updates.durationMs = Math.max(100, newDurationMs);
      } else if (overlayDragType === "resize-end") {
        // Resize from end (adjust duration only)
        let newDurationMs = dragOverlayDurationMs + deltaMs;
        updates.durationMs = Math.max(100, newDurationMs);
      }

      // Apply updates
      const result = timelineReducers.updateOverlay(
        sequence,
        dragOverlayId,
        updates
      );
      if ("sequence" in result) {
        onSequenceChange(result.sequence);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingOverlay(false);
      setIsResizingOverlay(false);
      setOverlayDragType(null);
      setDragOverlayId(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDraggingOverlay,
    isResizingOverlay,
    dragOverlayId,
    overlayDragType,
    dragStartX,
    dragOverlayStartMs,
    dragOverlayDurationMs,
    pixelsPerMs,
    sequence,
    playheadMs,
    snapEnabled,
    onSequenceChange,
  ]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // B = Blade (split at playhead)
      if (e.key === "b" || e.key === "B") {
        if (selectedClipId) {
          const result = timelineReducers.splitClip(
            sequence,
            selectedClipId,
            playheadMs
          );
          if ("sequence" in result && result.sequence) {
            onSequenceChange(result.sequence);
            setSelectedClipId(result.rightClipId || null);
          }
        }
      }

      // Delete = Delete selected clip or overlay
      if (e.key === "Delete" || e.key === "Backspace") {
        // Check if an overlay is selected
        if (selectedOverlayId && onSelectOverlay) {
          const result = timelineReducers.deleteOverlay(
            sequence,
            selectedOverlayId
          );
          if ("sequence" in result) {
            onSequenceChange(result.sequence);
            onSelectOverlay(null); // Deselect after deletion
          }
        } else if (selectedClipId) {
          // Delete clip
          const ripple = e.shiftKey; // Shift+Delete = ripple delete
          const result = timelineReducers.deleteClip(sequence, selectedClipId, {
            ripple,
          });
          if ("sequence" in result) {
            onSequenceChange(result.sequence);
            setSelectedClipId(null);
          }
        }
      }

      // Space = Play/Pause (handled by parent)
      // Arrow keys = Nudge (handled by parent)
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedClipId,
    selectedOverlayId,
    sequence,
    playheadMs,
    onSequenceChange,
    onSelectOverlay,
  ]);

  // Handle drag-and-drop from Media Library
  const handleDragOver = (e: React.DragEvent, trackId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
    if (trackId) {
      setDropTrackId(trackId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    setDropTrackId(null);
  };

  const handleDrop = async (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    setDropTrackId(null);

    const clipPath = e.dataTransfer.getData("application/clip-path");
    if (!clipPath) {
      console.log("[ProTimeline] No clip path in drop data");
      return;
    }

    console.log("[ProTimeline] Dropped clip:", clipPath, "on track:", trackId);

    try {
      // Probe the media to get timeline format
      const mediaInfo = await (window as any).electronAPI.media.probe(clipPath);
      console.log("[ProTimeline] Probed media info:", mediaInfo);

      // Add media to parent state if not already present
      if (onMediaAdd && !media[mediaInfo.id]) {
        onMediaAdd(mediaInfo.id, mediaInfo);
      }

      // Calculate drop position
      const dropTimeMs = screenXToMs(e.clientX);

      // Determine if media has video and/or audio
      const hasVideo = mediaInfo.kind === "video" && mediaInfo.streams?.v;
      const hasAudio = mediaInfo.streams?.a;

      let updatedSequence = sequence;

      // Find appropriate tracks or create new ones
      if (!sequence.tracks || !Array.isArray(sequence.tracks)) {
        console.error("[ProTimeline] Invalid sequence tracks");
        return;
      }

      const targetTrack = sequence.tracks.find((t) => t.id === trackId);
      if (!targetTrack) {
        console.error("[ProTimeline] Target track not found:", trackId);
        return;
      }

      // If dropping video (with or without audio), add as single clip to video track
      if (hasVideo) {
        // Always use the existing "Video" track (no new tracks)
        const videoTrack = updatedSequence.tracks.find(
          (t) => t.kind === "video"
        );

        if (!videoTrack) {
          console.error("[ProTimeline] Video track not found");
          return;
        }

        const videoTrackId = videoTrack.id;

        // Add video clip (audio is embedded in the video stream)
        const result = timelineReducers.addClip(
          updatedSequence,
          videoTrackId,
          mediaInfo.id,
          dropTimeMs,
          0,
          mediaInfo.durationMs
        );

        if ("sequence" in result && result.sequence) {
          updatedSequence = result.sequence;
        }

        console.log(
          "[ProTimeline] Added video clip",
          hasAudio ? "with embedded audio" : "(video only)"
        );
      } else if (hasAudio) {
        // Audio only - add to audio track
        let audioTrackId = targetTrack.kind === "audio" ? trackId : "Audio";
        let audioTrack = updatedSequence.tracks.find(
          (t) => t.id === audioTrackId
        );

        if (!audioTrack) {
          console.error("[ProTimeline] Audio track not found");
          return;
        }

        const result = timelineReducers.addClip(
          updatedSequence,
          audioTrackId,
          mediaInfo.id,
          dropTimeMs,
          0,
          mediaInfo.durationMs
        );

        if ("sequence" in result && result.sequence) {
          updatedSequence = result.sequence;
        }

        console.log("[ProTimeline] Added audio clip");
      }

      onSequenceChange(updatedSequence);
      console.log("[ProTimeline] Clip(s) added successfully");
      console.log("[ProTimeline] Updated sequence:", {
        trackCount: updatedSequence.tracks?.length,
        tracks: updatedSequence.tracks?.map((t) => ({
          id: t.id,
          clipCount: t.clips.length,
          clips: t.clips.map((c) => c.id),
        })),
      });
    } catch (error) {
      console.error("[ProTimeline] Failed to add dropped clip:", error);
    }
  };

  // Render time ruler
  const renderTimeRuler = () => {
    const maxTime = Math.max(sequence.durationMs, 60000); // At least 1 minute
    const timelineWidth = maxTime * pixelsPerMs;

    // Calculate tick interval based on zoom
    const minTickSpacing = 50; // pixels
    const tickIntervalMs =
      Math.ceil(minTickSpacing / pixelsPerMs / 1000) * 1000;

    const ticks = [];
    for (let time = 0; time <= maxTime; time += tickIntervalMs) {
      ticks.push(
        <div
          key={time}
          className="timeline-tick"
          style={{ left: `${time * pixelsPerMs}px` }}
        >
          <div className="timeline-tick-mark" />
          <div className="timeline-tick-label">{formatTimecode(time)}</div>
        </div>
      );
    }

    return (
      <div className="timeline-ruler" style={{ width: `${timelineWidth}px` }}>
        {ticks}
      </div>
    );
  };

  // Handle clip trim start (left edge)
  const handleTrimStart = (clip: TimelineClip, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    setTrimmingClip({
      clipId: clip.id,
      edge: "in",
      startX: e.clientX,
      startValue: clip.srcInMs,
    });
  };

  // Handle clip trim end (right edge)
  const handleTrimEnd = (clip: TimelineClip, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    setTrimmingClip({
      clipId: clip.id,
      edge: "out",
      startX: e.clientX,
      startValue: clip.srcOutMs,
    });
  };

  // Handle trim drag
  useEffect(() => {
    if (!trimmingClip) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - trimmingClip.startX;
      const deltaMs = deltaX / pixelsPerMs;

      // Find the clip and calculate new trim values based on ORIGINAL startValue
      const found = sequence.tracks
        .flatMap((t) => t.clips)
        .find((c) => c.id === trimmingClip.clipId);

      if (!found) return;

      const mediaInfo = media[found.mediaId];
      if (!mediaInfo) return;

      let newSrcInMs = found.srcInMs;
      let newSrcOutMs = found.srcOutMs;
      let newStartMs = found.startMs;

      if (trimmingClip.edge === "in") {
        // Calculate new in point from original startValue + delta
        newSrcInMs = Math.max(
          0,
          Math.min(trimmingClip.startValue + deltaMs, found.srcOutMs - 100)
        );
        // Also adjust startMs (timeline position) by the same delta
        const trimDelta = newSrcInMs - found.srcInMs;
        newStartMs = Math.max(0, found.startMs + trimDelta);
      } else {
        // Calculate new out point from original startValue + delta
        newSrcOutMs = Math.max(
          found.srcInMs + 100,
          Math.min(trimmingClip.startValue + deltaMs, mediaInfo.durationMs)
        );
      }

      // Update the clip directly
      const updatedClip = {
        ...found,
        srcInMs: newSrcInMs,
        srcOutMs: newSrcOutMs,
        startMs: newStartMs,
      };

      // Find the track and update it
      const trackIdx = sequence.tracks.findIndex((t) =>
        t.clips.some((c) => c.id === trimmingClip.clipId)
      );

      if (trackIdx === -1) return;

      const updatedTracks = [...sequence.tracks];
      updatedTracks[trackIdx] = {
        ...updatedTracks[trackIdx],
        clips: updatedTracks[trackIdx].clips.map((c) =>
          c.id === trimmingClip.clipId ? updatedClip : c
        ),
      };

      onSequenceChange({ ...sequence, tracks: updatedTracks });
    };

    const handleMouseUp = () => {
      setTrimmingClip(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [trimmingClip, sequence, media, pixelsPerMs, onSequenceChange]);

  // Render a clip
  const renderClip = (clip: TimelineClip, trackKind: "video" | "audio") => {
    const clipMedia = media[clip.mediaId];
    if (!clipMedia) return null;

    const clipDuration = timelineReducers.getClipDuration(clip);
    const clipWidth = clipDuration * pixelsPerMs;
    const clipLeft = clip.startMs * pixelsPerMs;

    const isSelected = selectedClipId === clip.id;

    return (
      <div
        key={clip.id}
        className={`timeline-clip ${isSelected ? "selected" : ""} ${trackKind}`}
        style={{
          left: `${clipLeft}px`,
          width: `${clipWidth}px`,
        }}
        onClick={(e) => handleClipClick(clip.id, e)}
        onMouseDown={(e) => handleClipMouseDown(clip, e)}
      >
        {/* LEFT TRIM HANDLE */}
        <div
          className="clip-trim-handle clip-trim-handle-left"
          onMouseDown={(e) => handleTrimStart(clip, e)}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="trim-handle-line" />
        </div>

        <div className="clip-content">
          {trackKind === "video" && (
            <div className="clip-thumbnail-strip">
              {/* Thumbnails would be rendered here */}
            </div>
          )}
          {trackKind === "audio" && (
            <div className="clip-waveform">
              {/* Waveform would be rendered here */}
            </div>
          )}
          <div className="clip-name">
            {clipMedia.path.split(/[/\\]/).pop()?.slice(0, 20)}
          </div>
        </div>

        {/* RIGHT TRIM HANDLE */}
        <div
          className="clip-trim-handle clip-trim-handle-right"
          onMouseDown={(e) => handleTrimEnd(clip, e)}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="trim-handle-line" />
        </div>

        {/* Transition indicators */}
        {clip.effects?.in && (
          <div className="clip-transition clip-transition-in">
            <span>X</span>
          </div>
        )}
        {clip.effects?.out && (
          <div className="clip-transition clip-transition-out">
            <span>X</span>
          </div>
        )}
      </div>
    );
  };

  // Render a track
  const renderTrack = (track: Track) => {
    const maxTime = Math.max(sequence.durationMs, 60000);
    const trackWidth = maxTime * pixelsPerMs;

    return (
      <div key={track.id} className="timeline-track-row">
        <div className="timeline-track-header">
          <div className="track-name">{track.id}</div>
        </div>
        <div
          className="timeline-track-content"
          style={{
            width: `${trackWidth}px`,
            height: track.height ? `${track.height}px` : undefined,
          }}
          onClick={handleTimelineClick}
          onDragOver={(e) => handleDragOver(e, track.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, track.id)}
        >
          {track.clips.map((clip) => renderClip(clip, track.kind))}
        </div>
      </div>
    );
  };

  // Calculate playhead position with sticky behavior
  const calculatePlayheadPosition = () => {
    const playheadPosition = playheadMs * pixelsPerMs;

    if (!tracksRef.current) return playheadPosition;

    const TRACK_HEADER_WIDTH = 120;
    const visibleWidth = tracksRef.current.clientWidth - TRACK_HEADER_WIDTH;
    const scrollRight = scrollLeft + visibleWidth;

    // If playhead is scrolled past left edge, stick it to left edge
    if (playheadPosition < scrollLeft) {
      return scrollLeft;
    }

    // If playhead is scrolled past right edge, stick it to right edge
    if (playheadPosition > scrollRight) {
      return scrollRight;
    }

    // Otherwise show at actual position
    return playheadPosition;
  };

  const displayPlayheadPosition = calculatePlayheadPosition();

  // Handle Add Text button
  const handleAddText = () => {
    const newOverlay = timelineReducers.createDefaultTextOverlay(
      playheadMs,
      3000 // 3 seconds default duration
    );
    const result = timelineReducers.addOverlay(sequence, newOverlay);
    if ("sequence" in result) {
      onSequenceChange(result.sequence);
      if (onSelectOverlay) {
        onSelectOverlay(result.overlayId);
      }
    }
  };

  // Render overlay bar in timeline
  const renderOverlay = (overlay: Overlay) => {
    const overlayWidth = overlay.durationMs * pixelsPerMs;
    const overlayLeft = overlay.startMs * pixelsPerMs;
    const isSelected = selectedOverlayId === overlay.id;

    const handleOverlayMouseDown = (
      e: React.MouseEvent,
      type: "move" | "resize-start" | "resize-end"
    ) => {
      e.preventDefault();
      e.stopPropagation();

      if (type === "move") {
        setIsDraggingOverlay(true);
      } else {
        setIsResizingOverlay(true);
      }

      setOverlayDragType(type);
      setDragOverlayId(overlay.id);
      setDragStartX(e.clientX);
      setDragOverlayStartMs(overlay.startMs);
      setDragOverlayDurationMs(overlay.durationMs);

      if (onSelectOverlay) {
        onSelectOverlay(overlay.id);
      }
    };

    return (
      <div
        key={overlay.id}
        className={`timeline-overlay ${isSelected ? "selected" : ""}`}
        style={{
          left: `${overlayLeft}px`,
          width: `${overlayWidth}px`,
        }}
      >
        {/* Left resize handle */}
        <div
          className="overlay-resize-handle overlay-resize-handle-left"
          onMouseDown={(e) => handleOverlayMouseDown(e, "resize-start")}
        />

        {/* Main content area */}
        <div
          className="overlay-content"
          onMouseDown={(e) => handleOverlayMouseDown(e, "move")}
          onClick={(e) => {
            e.stopPropagation();
            if (onSelectOverlay) {
              onSelectOverlay(overlay.id);
            }
          }}
        >
          <span className="overlay-icon">T</span>
          <span className="overlay-label">{overlay.content.slice(0, 15)}</span>
        </div>

        {/* Right resize handle */}
        <div
          className="overlay-resize-handle overlay-resize-handle-right"
          onMouseDown={(e) => handleOverlayMouseDown(e, "resize-end")}
        />
      </div>
    );
  };

  return (
    <div className="pro-timeline">
      <div className="timeline-header">
        <div className="timeline-header-left">
          <div className="timeline-title">Timeline</div>
          <button
            className="timeline-add-text-button"
            onClick={handleAddText}
            title="Add Text Overlay (at playhead)"
          >
            + Text
          </button>
        </div>
        <div className="timeline-header-center">
          <div className="timeline-timecode">{formatTimecode(playheadMs)}</div>
        </div>
        <div className="timeline-header-right">
          <button
            className={`timeline-tool-button ${snapEnabled ? "active" : ""}`}
            onClick={() => setSnapEnabled(!snapEnabled)}
            title="Toggle Snapping"
          >
            🧲
          </button>
          <div className="timeline-zoom-controls">
            <button className="zoom-button" onClick={handleZoomOut}>
              −
            </button>
            <span className="zoom-label">{zoom}%</span>
            <button className="zoom-button" onClick={handleZoomIn}>
              +
            </button>
          </div>
        </div>
      </div>

      <div className="timeline-ruler-container">
        <div className="timeline-ruler-spacer" />
        <div className="timeline-ruler-scroll" ref={timelineRef}>
          {renderTimeRuler()}
        </div>
      </div>

      <div className="timeline-tracks" ref={tracksRef}>
        {/* Video Track (V1) */}
        {sequence?.tracks &&
          Array.isArray(sequence.tracks) &&
          sequence.tracks
            .filter((track) => track.kind === "video")
            .map((track) => renderTrack(track))}

        {/* Text/Overlay Track - Always show even if empty */}
        <div className="timeline-overlay-track">
          <div className="timeline-track-header">
            <div className="track-name">Text</div>
          </div>
          <div
            className="timeline-overlay-track-content"
            style={{
              width: `${Math.max(sequence.durationMs, 60000) * pixelsPerMs}px`,
            }}
            onClick={handleTimelineClick}
          >
            {sequence?.overlays &&
              sequence.overlays.map((overlay) => renderOverlay(overlay))}
          </div>
        </div>

        {/* Audio Track (A1) */}
        {sequence?.tracks &&
          Array.isArray(sequence.tracks) &&
          sequence.tracks
            .filter((track) => track.kind === "audio")
            .map((track) => renderTrack(track))}

        {/* Playhead */}
        <div
          className="timeline-playhead"
          style={{ left: `${displayPlayheadPosition}px` }}
          onMouseDown={handlePlayheadMouseDown}
        >
          <div className="playhead-handle" />
          <div className="playhead-line" />
        </div>
      </div>
    </div>
  );
};

export default ProTimeline;
