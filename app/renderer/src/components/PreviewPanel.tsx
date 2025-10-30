/**
 * PreviewPanel Component
 * @mem ref: design-spec, pr7-preview-player, pr16-text-overlays
 * Center panel for video preview and playback
 * HTML5 video player with trim-aware playback and scrubbing
 * Updated for PR #14: Now works with timeline sequence and playhead
 * Updated for PR #16: Renders text overlays on preview
 */

import React, { useState, useRef, useEffect, useMemo } from "react";
import "./PreviewPanel.css";
import type {
  Sequence,
  MediaInfo,
  Clip as TimelineClip,
  Overlay,
} from "../../../shared/timelineTypes";
import * as timelineReducers from "../../../shared/timelineReducers";

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
  // New timeline props
  sequence?: Sequence;
  media?: Record<string, MediaInfo>;
  playheadMs?: number;
  onPlayheadChange?: (timeMs: number) => void; // New prop for updating playhead
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({
  clip,
  onCurrentTimeChange,
  onSeekTo,
  sequence,
  media,
  playheadMs = 0,
  onPlayheadChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDraggingScrubber, setIsDraggingScrubber] = useState(false);
  const playheadRef = useRef<number>(playheadMs);

  // Keep ref in sync
  useEffect(() => {
    playheadRef.current = playheadMs;
  }, [playheadMs]);

  // Find the clip at the current playhead position (from timeline)
  const findClipAtPlayhead = (): {
    clip: TimelineClip;
    mediaInfo: MediaInfo;
  } | null => {
    if (
      !sequence ||
      !media ||
      !sequence.tracks ||
      !Array.isArray(sequence.tracks)
    ) {
      return null;
    }

    // Search video tracks first (top-to-bottom priority)
    for (const track of sequence.tracks) {
      if (track.kind !== "video") continue;

      for (const timelineClip of track.clips) {
        const clipEnd =
          timelineClip.startMs + (timelineClip.srcOutMs - timelineClip.srcInMs);
        if (playheadMs >= timelineClip.startMs && playheadMs < clipEnd) {
          const mediaInfo = media[timelineClip.mediaId];
          if (mediaInfo) {
            return { clip: timelineClip, mediaInfo };
          }
        }
      }
    }

    // If no video clip found, check audio tracks
    for (const track of sequence.tracks) {
      if (track.kind !== "audio") continue;

      for (const timelineClip of track.clips) {
        const clipEnd =
          timelineClip.startMs + (timelineClip.srcOutMs - timelineClip.srcInMs);
        if (playheadMs >= timelineClip.startMs && playheadMs < clipEnd) {
          const mediaInfo = media[timelineClip.mediaId];
          if (mediaInfo) {
            return { clip: timelineClip, mediaInfo };
          }
        }
      }
    }

    return null;
  };

  const activeTimelineClip = findClipAtPlayhead();

  // Determine if current media is audio-only
  const isAudioOnly = useMemo(() => {
    return activeTimelineClip?.mediaInfo.kind === "audio";
  }, [activeTimelineClip]);

  // Get the active media element (video or audio)
  const getMediaElement = (): HTMLVideoElement | HTMLAudioElement | null => {
    return isAudioOnly ? audioRef.current : videoRef.current;
  };

  // Get overlays visible at current playhead
  const activeOverlays = useMemo((): Overlay[] => {
    if (!sequence) return [];
    return timelineReducers.getOverlaysAtTime(sequence, playheadMs);
  }, [sequence, playheadMs]);

  // Check if there are any video or audio clips on the timeline (even if not at current playhead)
  const hasTimelineClips = useMemo(() => {
    return (
      sequence &&
      sequence.tracks &&
      Array.isArray(sequence.tracks) &&
      sequence.tracks.some(
        (track) =>
          (track.kind === "video" || track.kind === "audio") &&
          track.clips.length > 0
      )
    );
  }, [sequence]);

  // Calculate timeline duration (furthest clip end point)
  const timelineDuration = useMemo(() => {
    if (!sequence?.tracks || !Array.isArray(sequence.tracks)) return 0;

    let maxTime = 0;
    for (const track of sequence.tracks) {
      for (const clip of track.clips) {
        const clipEnd = clip.startMs + (clip.srcOutMs - clip.srcInMs);
        if (clipEnd > maxTime) {
          maxTime = clipEnd;
        }
      }
    }
    return maxTime;
  }, [sequence]);

  // Reset playback state when clip changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    const mediaEl = getMediaElement();
    if (mediaEl) {
      mediaEl.pause();
      mediaEl.currentTime = 0;
      // Reset audio properties to prevent distortion on clip change
      mediaEl.playbackRate = 1.0;
      mediaEl.defaultPlaybackRate = 1.0;
      mediaEl.volume = 1.0;
    }
  }, [clip?.id, isAudioOnly]);

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

  // Advance playhead when playing but not over a clip (seeking to next clip or reaching end)
  useEffect(() => {
    if (!isPlaying || activeTimelineClip || !onPlayheadChange || !sequence)
      return;

    // Not over a clip, but playing - advance playhead to find next clip
    const interval = setInterval(() => {
      const newPlayhead = playheadRef.current + 33; // Advance ~30fps

      // Check if we've passed all clips (reached the end of timeline)
      if (newPlayhead > timelineDuration) {
        // Stop playback at the end
        setIsPlaying(false);
        onPlayheadChange(timelineDuration);
        return;
      }

      playheadRef.current = newPlayhead;
      onPlayheadChange(newPlayhead);
    }, 33);

    return () => clearInterval(interval);
  }, [
    isPlaying,
    activeTimelineClip,
    onPlayheadChange,
    sequence,
    timelineDuration,
  ]);

  // Sync video/audio position when playhead changes externally (e.g., dragging timeline playhead)
  useEffect(() => {
    const mediaEl = getMediaElement();
    if (!activeTimelineClip || !mediaEl) return;

    const { clip: timelineClip } = activeTimelineClip;

    // Calculate the source time within the media file
    const offsetInClip = playheadMs - timelineClip.startMs;
    const sourceTimeMs = timelineClip.srcInMs + offsetInClip;
    const sourceTimeSeconds = sourceTimeMs / 1000;

    // Only update if significantly different (avoid thrashing)
    const currentTime = mediaEl.currentTime;
    const timeDiff = Math.abs(currentTime - sourceTimeSeconds);

    if (timeDiff > 0.2) {
      // More than 200ms difference - seek to correct position
      mediaEl.currentTime = sourceTimeSeconds;

      // If we're playing, make sure the new clip starts playing
      if (isPlaying && mediaEl.paused) {
        mediaEl.play().catch((error) => {
          console.error(
            "[PreviewPanel] Error playing media after seek:",
            error
          );
        });
      }
    }
  }, [playheadMs, activeTimelineClip, isAudioOnly, isPlaying]);

  // Ensure stable playback rate (prevent audio distortion)
  useEffect(() => {
    const mediaEl = getMediaElement();
    if (mediaEl && activeTimelineClip) {
      mediaEl.playbackRate = 1.0;
      mediaEl.defaultPlaybackRate = 1.0;
      if ("preservesPitch" in mediaEl) {
        (mediaEl as any).preservesPitch = true;
      }
      // Ensure volume is set correctly
      mediaEl.volume = 1.0;
    }
  }, [activeTimelineClip, isAudioOnly]);

  // Sync play/pause state with media element (only when over a clip)
  useEffect(() => {
    const mediaEl = getMediaElement();
    if (!mediaEl || !activeTimelineClip) return;

    if (isPlaying && mediaEl.paused) {
      mediaEl.play().catch((error) => {
        console.error("[PreviewPanel] Error playing media:", error);
      });
    } else if (!isPlaying && !mediaEl.paused) {
      mediaEl.pause();
    }
  }, [isPlaying, activeTimelineClip, isAudioOnly]);

  // Handle video loaded metadata
  const handleLoadedMetadata = () => {
    if (videoRef.current && clip) {
      const video = videoRef.current;
      setDuration((clip.outMs - clip.inMs) / 1000);
      // Start at trim in point
      video.currentTime = clip.inMs / 1000;
      setCurrentTime(0);
    }

    // Ensure audio is initialized properly on load
    if (videoRef.current) {
      videoRef.current.volume = 1.0;
      videoRef.current.playbackRate = 1.0;
    }
  };

  // Handle time update - enforce trim bounds (legacy clip mode)
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

  // Handle time update for timeline mode - MEDIA DRIVES PLAYHEAD
  const handleTimelineTimeUpdate = () => {
    const mediaEl = getMediaElement();
    if (!mediaEl || !activeTimelineClip || !onPlayheadChange) return;

    const { clip: timelineClip } = activeTimelineClip;
    const mediaTimeSeconds = mediaEl.currentTime;
    const mediaTimeMs = mediaTimeSeconds * 1000;

    // Convert media time to timeline position
    const offsetInSource = mediaTimeMs - timelineClip.srcInMs;
    const timelinePosition = timelineClip.startMs + offsetInSource;

    // Check if we've reached the end of the clip
    const clipEndMs =
      timelineClip.startMs + (timelineClip.srcOutMs - timelineClip.srcInMs);

    if (timelinePosition >= clipEndMs) {
      // We've reached the end of this clip
      // Move playhead forward and let the system handle loading the next clip
      onPlayheadChange(clipEndMs);

      // DON'T pause - let the playhead advance effect handle the next clip
      // The play/pause sync effect will start the next clip playing
      return;
    }

    // Update playhead to match media position
    onPlayheadChange(timelinePosition);
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
    // Only work with timeline clips
    if (!hasTimelineClips) {
      return;
    }

    if (isPlaying) {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      // Just start playing - the playhead will advance and preview will update as it moves over clips
      setIsPlaying(true);
    }
  };

  // Handle spacebar shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && hasTimelineClips) {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasTimelineClips, isPlaying]);

  // Skip to start (beginning of timeline at 00:00:00)
  const skipToStart = () => {
    // Pause playback when skipping
    if (isPlaying) {
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }

    if (hasTimelineClips && onPlayheadChange) {
      // Go to the beginning of the timeline
      onPlayheadChange(0);
    } else if (videoRef.current && clip) {
      // Legacy clip mode
      videoRef.current.currentTime = clip.inMs / 1000;
      setCurrentTime(0);
    }
  };

  // Skip to end (end of timeline)
  const skipToEnd = () => {
    // Pause playback when skipping
    if (isPlaying) {
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }

    if (hasTimelineClips && onPlayheadChange) {
      // Go to the end of the timeline (last clip end position)
      onPlayheadChange(timelineDuration);
    } else if (videoRef.current && clip) {
      // Legacy clip mode
      const outSeconds = clip.outMs / 1000;
      videoRef.current.currentTime = outSeconds - 0.1;
      setCurrentTime((clip.outMs - clip.inMs) / 1000 - 0.1);
    }
  };

  // Handle scrubber drag
  const handleScrubberMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingScrubber(true);
    handleScrubberSeek(e);
  };

  const handleScrubberSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onPlayheadChange) return;

    const scrubberBar = e.currentTarget;
    const rect = scrubberBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));

    // Seek to timeline position
    const newTimelinePosition = percentage * timelineDuration;
    onPlayheadChange(newTimelinePosition);
  };

  // Handle mouse move during scrubber drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingScrubber || !onPlayheadChange) return;

      const scrubberBar = document.querySelector(
        ".scrubber-bar"
      ) as HTMLElement;
      if (!scrubberBar) return;

      const rect = scrubberBar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));

      // Seek to timeline position
      const newTimelinePosition = percentage * timelineDuration;
      onPlayheadChange(newTimelinePosition);
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
  }, [isDraggingScrubber, timelineDuration, onPlayheadChange]);

  // Format time as MM:SS from milliseconds
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Calculate overlay animation opacity based on position in overlay lifecycle
  const calculateOverlayOpacity = (overlay: Overlay): number => {
    const overlayStartMs = overlay.startMs;
    const overlayEndMs = overlay.startMs + overlay.durationMs;
    const elapsed = playheadMs - overlayStartMs;
    const remaining = overlayEndMs - playheadMs;

    let opacity = 1;

    // Fade in animation
    if (overlay.animation?.in && elapsed < overlay.animation.in.durationMs) {
      const fadeProgress = elapsed / overlay.animation.in.durationMs;
      opacity = Math.min(1, fadeProgress);
    }

    // Fade out animation
    if (
      overlay.animation?.out &&
      remaining < overlay.animation.out.durationMs
    ) {
      const fadeProgress = remaining / overlay.animation.out.durationMs;
      opacity = Math.min(opacity, fadeProgress);
    }

    return opacity;
  };

  // Calculate overlay position transform
  const calculateOverlayTransform = (overlay: Overlay): string => {
    const overlayStartMs = overlay.startMs;
    const elapsed = playheadMs - overlayStartMs;

    let translateY = 0;

    // FadeUp animation - start from bottom
    if (overlay.animation?.in?.type === "fadeUp") {
      if (elapsed < overlay.animation.in.durationMs) {
        const progress = elapsed / overlay.animation.in.durationMs;
        translateY = (1 - progress) * 20; // Move up 20px
      }
    }

    // FadeDown animation - start from top
    if (overlay.animation?.in?.type === "fadeDown") {
      if (elapsed < overlay.animation.in.durationMs) {
        const progress = elapsed / overlay.animation.in.durationMs;
        translateY = (progress - 1) * 20; // Move down 20px
      }
    }

    return `translateY(${translateY}px)`;
  };

  // Render text overlay
  const renderOverlay = (overlay: Overlay, index: number) => {
    if (overlay.kind !== "text") return null;

    const opacity = calculateOverlayOpacity(overlay);
    const transform = calculateOverlayTransform(overlay);

    // Get video dimensions from active clip to match FFmpeg export
    const videoWidth = activeTimelineClip?.mediaInfo.streams.v?.w || 1920;
    const videoHeight = activeTimelineClip?.mediaInfo.streams.v?.h || 1080;

    // Calculate position to MATCH FFmpeg export logic
    const { x, y, anchor } = overlay.bounds;

    let leftPos: string;
    let topPos: string;
    let anchorTransform = "";

    switch (anchor) {
      case "center":
        // FFmpeg: x=(w-text_w)/2, y=(h-text_h)/2
        leftPos = "50%";
        topPos = "50%";
        anchorTransform = "translate(-50%, -50%)";
        break;
      case "tl":
        // FFmpeg: x=overlay.bounds.x*videoWidth, y=overlay.bounds.y*videoHeight
        leftPos = `${x * 100}%`;
        topPos = `${y * 100}%`;
        anchorTransform = "translate(0%, 0%)";
        break;
      case "tc":
        // Top Center
        leftPos = "50%";
        topPos = `${y * 100}%`;
        anchorTransform = "translate(-50%, 0%)";
        break;
      case "tr":
        // FFmpeg: x=w-text_w-(1-overlay.bounds.x)*videoWidth
        leftPos = `${x * 100}%`;
        topPos = `${y * 100}%`;
        anchorTransform = "translate(-100%, 0%)";
        break;
      case "bl":
        // FFmpeg: x=overlay.bounds.x*videoWidth, y=h-text_h-(1-overlay.bounds.y)*videoHeight
        leftPos = `${x * 100}%`;
        topPos = `${y * 100}%`;
        anchorTransform = "translate(0%, -100%)";
        break;
      case "bc":
        // Bottom Center
        leftPos = "50%";
        topPos = `${y * 100}%`;
        anchorTransform = "translate(-50%, -100%)";
        break;
      case "br":
        // FFmpeg: x=w-text_w-(1-overlay.bounds.x)*videoWidth
        leftPos = `${x * 100}%`;
        topPos = `${y * 100}%`;
        anchorTransform = "translate(-100%, -100%)";
        break;
      default:
        leftPos = `${x * 100}%`;
        topPos = `${y * 100}%`;
        anchorTransform = "translate(-50%, -50%)";
    }

    // Improved 8-directional stroke rendering to better match FFmpeg borderw
    const strokeStyle = overlay.stroke
      ? `
          -${overlay.stroke.width}px -${overlay.stroke.width}px 0 ${overlay.stroke.color},
          ${overlay.stroke.width}px -${overlay.stroke.width}px 0 ${overlay.stroke.color},
          -${overlay.stroke.width}px ${overlay.stroke.width}px 0 ${overlay.stroke.color},
          ${overlay.stroke.width}px ${overlay.stroke.width}px 0 ${overlay.stroke.color},
          0 -${overlay.stroke.width}px 0 ${overlay.stroke.color},
          0 ${overlay.stroke.width}px 0 ${overlay.stroke.color},
          -${overlay.stroke.width}px 0 0 ${overlay.stroke.color},
          ${overlay.stroke.width}px 0 0 ${overlay.stroke.color}
        `
      : undefined;

    const textStyle: React.CSSProperties = {
      position: "absolute",
      left: leftPos,
      top: topPos,
      transform: `${anchorTransform} ${transform}`,
      opacity,
      fontFamily: overlay.font.family,
      fontSize: `${overlay.font.size}px`,
      fontWeight: overlay.font.weight || 700,
      color: overlay.fill,
      textShadow: strokeStyle,
      pointerEvents: "none",
      whiteSpace: "pre-wrap",
      textAlign: "center",
      lineHeight: overlay.font.lineHeight || 1.2,
      letterSpacing: overlay.font.letterSpacing
        ? `${overlay.font.letterSpacing}px`
        : undefined,
      zIndex: 10 + index,
      transition: "opacity 0.1s ease-out",
    };

    return (
      <div key={overlay.id} style={textStyle}>
        {overlay.content}
      </div>
    );
  };

  return (
    <div className="preview-panel">
      <div className="preview-container">
        <div className="preview-video">
          {!activeTimelineClip ? (
            <div className="empty-preview">
              <div className="empty-preview-icon">▶</div>
              <p className="empty-preview-text">
                {hasTimelineClips
                  ? "Move playhead over a clip to preview"
                  : "Add clips to timeline to preview"}
              </p>
            </div>
          ) : (
            <>
              {/* Render video element for video media */}
              {!isAudioOnly && (
                <>
                  <video
                    key={`timeline-video-${activeTimelineClip.mediaInfo.id}`}
                    ref={videoRef}
                    className="video-player"
                    src={`file://${activeTimelineClip.mediaInfo.path}`}
                    preload="auto"
                    playsInline
                    muted={false}
                    volume={1.0}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimelineTimeUpdate}
                    onError={(e) => {
                      console.error("[PreviewPanel] Video error:", e);
                    }}
                  />
                  {/* Render overlays on top of video */}
                  {activeOverlays.length > 0 && (
                    <div className="preview-overlay-layer">
                      {activeOverlays.map((overlay, index) =>
                        renderOverlay(overlay, index)
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Render audio element for audio-only media */}
              {isAudioOnly && (
                <div className="audio-only-preview">
                  <audio
                    key={`timeline-audio-${activeTimelineClip.mediaInfo.id}`}
                    ref={audioRef}
                    src={`file://${activeTimelineClip.mediaInfo.path}`}
                    preload="auto"
                    volume={1.0}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimelineTimeUpdate}
                    onError={(e) => {
                      console.error("[PreviewPanel] Audio error:", e);
                    }}
                  />
                  <div className="audio-only-visualizer">
                    <div className="audio-icon">🎵</div>
                    <div className="audio-filename">
                      {activeTimelineClip.mediaInfo.path.split("/").pop()}
                    </div>
                    <div className="audio-waveform">
                      <div
                        className="waveform-bar"
                        style={{ animationDelay: "0ms" }}
                      ></div>
                      <div
                        className="waveform-bar"
                        style={{ animationDelay: "100ms" }}
                      ></div>
                      <div
                        className="waveform-bar"
                        style={{ animationDelay: "200ms" }}
                      ></div>
                      <div
                        className="waveform-bar"
                        style={{ animationDelay: "300ms" }}
                      ></div>
                      <div
                        className="waveform-bar"
                        style={{ animationDelay: "400ms" }}
                      ></div>
                      <div
                        className="waveform-bar"
                        style={{ animationDelay: "500ms" }}
                      ></div>
                      <div
                        className="waveform-bar"
                        style={{ animationDelay: "600ms" }}
                      ></div>
                      <div
                        className="waveform-bar"
                        style={{ animationDelay: "700ms" }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Scrubber bar - always visible, shows timeline position */}
          {hasTimelineClips && (
            <div className="scrubber-container">
              <span className="scrubber-time">{formatTime(playheadMs)}</span>
              <div
                className="scrubber-bar"
                onMouseDown={handleScrubberMouseDown}
              >
                <div
                  className="scrubber-progress"
                  style={{
                    width: `${
                      timelineDuration > 0
                        ? (playheadMs / timelineDuration) * 100
                        : 0
                    }%`,
                  }}
                />
                <div
                  className="scrubber-handle"
                  style={{
                    left: `${
                      timelineDuration > 0
                        ? (playheadMs / timelineDuration) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <span className="scrubber-time">
                {formatTime(timelineDuration)}
              </span>
            </div>
          )}
        </div>

        <div className="preview-controls">
          <button
            className="control-button"
            onClick={skipToStart}
            disabled={!hasTimelineClips}
            title="Skip to start (trim in point)"
          >
            ⏮
          </button>
          <button
            className="control-button primary"
            onClick={togglePlayPause}
            disabled={!hasTimelineClips}
            title="Play/Pause (Spacebar)"
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            className="control-button"
            onClick={skipToEnd}
            disabled={!hasTimelineClips}
            title="Skip to end (trim out point)"
          >
            ⏭
          </button>
        </div>
      </div>
    </div>
  );
};

// Memoize to prevent unnecessary re-renders caused by parent re-renders
export default React.memo(PreviewPanel, (prevProps, nextProps) => {
  // Only re-render if these specific values change
  return (
    prevProps.playheadMs === nextProps.playheadMs &&
    prevProps.sequence === nextProps.sequence &&
    prevProps.media === nextProps.media &&
    prevProps.clip?.id === nextProps.clip?.id
  );
});
