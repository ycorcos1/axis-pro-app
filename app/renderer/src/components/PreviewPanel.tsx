/**
 * PreviewPanel Component
 * @mem ref: design-spec, pr7-preview-player
 * Center panel for video preview and playback
 * HTML5 video player with trim-aware playback and scrubbing
 */

import React, { useState, useRef, useEffect } from "react";
import "./PreviewPanel.css";

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

interface PreviewPanelProps {
  clip: Clip | null;
  onCurrentTimeChange?: (timeMs: number) => void;
  onSeekTo?: (timeMs: number) => void;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({
  clip,
  onCurrentTimeChange,
  onSeekTo,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDraggingScrubber, setIsDraggingScrubber] = useState(false);

  // Reset playback state when clip changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [clip?.id]);

  // Update when trim points change
  useEffect(() => {
    if (videoRef.current && clip) {
      const inSeconds = clip.inMs / 1000;
      const outSeconds = clip.outMs / 1000;
      const newDuration = outSeconds - inSeconds;

      const currentAbsoluteTime = videoRef.current.currentTime;

      // If current time is outside trim bounds, clamp to bounds
      if (currentAbsoluteTime < inSeconds) {
        videoRef.current.currentTime = inSeconds;
        setCurrentTime(0);
      } else if (currentAbsoluteTime > outSeconds) {
        videoRef.current.currentTime = outSeconds;
        setCurrentTime(newDuration);
        // Pause if playing past the out point
        if (isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      } else {
        // Recalculate relative time for current position
        const relativeTime = currentAbsoluteTime - inSeconds;
        setCurrentTime(relativeTime);
      }

      setDuration(newDuration);
    }
  }, [clip?.inMs, clip?.outMs, isPlaying]);

  // Handle video loaded metadata
  const handleLoadedMetadata = () => {
    if (videoRef.current && clip) {
      const video = videoRef.current;
      setDuration((clip.outMs - clip.inMs) / 1000);
      // Start at trim in point
      video.currentTime = clip.inMs / 1000;
      setCurrentTime(0);
    }
  };

  // Handle time update - enforce trim bounds
  const handleTimeUpdate = () => {
    if (videoRef.current && clip && !isDraggingScrubber) {
      const video = videoRef.current;
      const absoluteTime = video.currentTime;
      const inSeconds = clip.inMs / 1000;
      const outSeconds = clip.outMs / 1000;

      // Check if we've reached the out point
      if (absoluteTime >= outSeconds) {
        video.currentTime = inSeconds;
        video.pause();
        setIsPlaying(false);
        setCurrentTime(0);
        return;
      }

      // Check if we've gone before the in point
      if (absoluteTime < inSeconds) {
        video.currentTime = inSeconds;
      }

      // Update relative current time (0 = inMs, duration = outMs - inMs)
      const relativeTime = absoluteTime - inSeconds;
      setCurrentTime(relativeTime);

      // Notify parent of absolute time change (in milliseconds)
      if (onCurrentTimeChange) {
        const absoluteTimeMs = absoluteTime * 1000;
        onCurrentTimeChange(absoluteTimeMs);
      }
    }
  };

  // Expose seek function for external use (e.g., from Timeline)
  const seekToAbsoluteTime = (timeMs: number) => {
    if (!videoRef.current || !clip) return;

    const targetSeconds = timeMs / 1000;
    const inSeconds = clip.inMs / 1000;
    const outSeconds = clip.outMs / 1000;

    // Clamp to clip bounds
    const clampedTime = Math.max(
      inSeconds,
      Math.min(targetSeconds, outSeconds)
    );

    videoRef.current.currentTime = clampedTime;

    // Update state
    setCurrentTime(clampedTime - inSeconds);
  };

  // Expose seek function via parent callback
  if (onSeekTo) {
    (window as any).__previewSeek = seekToAbsoluteTime;
  }

  // Toggle play/pause
  const togglePlayPause = () => {
    if (!videoRef.current || !clip) return;

    const video = videoRef.current;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      // Ensure we start at the correct position
      const inSeconds = clip.inMs / 1000;
      const outSeconds = clip.outMs / 1000;

      if (video.currentTime >= outSeconds || video.currentTime < inSeconds) {
        video.currentTime = inSeconds;
      }

      video.play().catch((error) => {
        console.error("[PreviewPanel] Error playing video:", error);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  };

  // Handle spacebar shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && clip) {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clip, isPlaying]);

  // Skip to start (in point)
  const skipToStart = () => {
    if (videoRef.current && clip) {
      videoRef.current.currentTime = clip.inMs / 1000;
      setCurrentTime(0);
    }
  };

  // Skip to end (out point)
  const skipToEnd = () => {
    if (videoRef.current && clip) {
      const outSeconds = clip.outMs / 1000;
      videoRef.current.currentTime = outSeconds - 0.1; // slight offset to avoid loop
      setCurrentTime((clip.outMs - clip.inMs) / 1000 - 0.1);
    }
  };

  // Handle scrubber drag
  const handleScrubberMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!clip) return;
    setIsDraggingScrubber(true);
    handleScrubberSeek(e);
  };

  const handleScrubberSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!clip || !videoRef.current) return;

    const scrubberBar = e.currentTarget;
    const rect = scrubberBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));

    const trimmedDuration = (clip.outMs - clip.inMs) / 1000;
    const newRelativeTime = percentage * trimmedDuration;
    const newAbsoluteTime = clip.inMs / 1000 + newRelativeTime;

    videoRef.current.currentTime = newAbsoluteTime;
    setCurrentTime(newRelativeTime);
  };

  // Handle mouse move during scrubber drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingScrubber || !clip || !videoRef.current) return;

      const scrubberBar = document.querySelector(
        ".scrubber-bar"
      ) as HTMLElement;
      if (!scrubberBar) return;

      const rect = scrubberBar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));

      const trimmedDuration = (clip.outMs - clip.inMs) / 1000;
      const newRelativeTime = percentage * trimmedDuration;
      const newAbsoluteTime = clip.inMs / 1000 + newRelativeTime;

      videoRef.current.currentTime = newAbsoluteTime;
      setCurrentTime(newRelativeTime);
    };

    const handleMouseUp = () => {
      setIsDraggingScrubber(false);
    };

    if (isDraggingScrubber) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDraggingScrubber, clip]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="preview-panel">
      <div className="preview-container">
        <div className="preview-video">
          {!clip ? (
            <div className="empty-preview">
              <div className="empty-preview-icon">▶</div>
              <p className="empty-preview-text">Preview will appear here</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="video-player"
                src={`file://${clip.path}`}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
              />

              {/* Scrubber bar */}
              <div className="scrubber-container">
                <span className="scrubber-time">{formatTime(currentTime)}</span>
                <div
                  className="scrubber-bar"
                  onMouseDown={handleScrubberMouseDown}
                >
                  <div
                    className="scrubber-progress"
                    style={{
                      width: `${
                        duration > 0 ? (currentTime / duration) * 100 : 0
                      }%`,
                    }}
                  />
                  <div
                    className="scrubber-handle"
                    style={{
                      left: `${
                        duration > 0 ? (currentTime / duration) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="scrubber-time">{formatTime(duration)}</span>
              </div>
            </>
          )}
        </div>

        <div className="preview-controls">
          <button
            className="control-button"
            onClick={skipToStart}
            disabled={!clip}
            title="Skip to start (trim in point)"
          >
            ⏮
          </button>
          <button
            className="control-button primary"
            onClick={togglePlayPause}
            disabled={!clip}
            title="Play/Pause (Spacebar)"
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            className="control-button"
            onClick={skipToEnd}
            disabled={!clip}
            title="Skip to end (trim out point)"
          >
            ⏭
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewPanel;
