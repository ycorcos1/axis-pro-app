/**
 * Timeline Types for PR #14 — Pro Timeline
 * @mem ref: pr14-timeline, multi-track-editing
 * Defines the data model for multi-track timeline editing
 */

export type MediaId = string;
export type ClipId = string;
export type TrackId = string;

/**
 * Media information stored in project
 * Source of truth for imported media files
 */
export interface MediaInfo {
  id: MediaId;
  path: string;
  kind: "video" | "audio" | "image";
  durationMs: number;
  streams: {
    v?: { fps: number; w: number; h: number };
    a?: { rate: number; channels: number };
  };
  thumbsDir?: string;
  waveformPath?: string;
}

/**
 * Transition types for video and audio
 */
export type TransitionKind = "crossfade" | "dip-black" | "dip-white";

export interface Transition {
  kind: TransitionKind;
  durationMs: number;
}

/**
 * Timeline clip
 * References a media item and defines its placement/trim
 */
export interface Clip {
  id: ClipId;
  mediaId: MediaId;
  srcInMs: number;
  srcOutMs: number;
  startMs: number; // position on timeline
  effects?: {
    in?: Transition;
    out?: Transition;
  };
  linkedTo?: ClipId; // clipId of A/V mate (for linked clips)
}

/**
 * Track in the timeline
 * Contains clips sorted by startMs, no overlap per track
 */
export interface Track {
  id: TrackId;
  kind: "video" | "audio";
  clips: Clip[]; // sorted by startMs, no overlap
  visible?: boolean;
  muted?: boolean;
  height?: number; // UI height in pixels
}

/**
 * Timeline sequence
 * Contains all tracks and sequence settings
 */
export interface Sequence {
  id: string;
  name: string;
  fps: 30 | 60;
  resolution: { w: number; h: number };
  snapGridMs: number; // e.g., 100
  tracks: Track[];
  overlays?: Overlay[]; // PR #16 - Text overlays
  durationMs: number; // computed from rightmost clip
}

/**
 * Project with timeline support
 * Replaces the old Project model
 */
export interface TimelineProject {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  media: Record<MediaId, MediaInfo>;
  sequence: Sequence;
  previewThumbPath?: string;
}

/**
 * Options for clip manipulation operations
 */
export interface ClipOperationOptions {
  snap?: boolean;
  ripple?: boolean;
}

/**
 * Result from clip operations
 */
export interface ClipOperationResult {
  success: boolean;
  error?: string;
  affectedClipIds?: ClipId[];
}

/**
 * Split result returns IDs of both resulting clips
 */
export interface SplitResult extends ClipOperationResult {
  sequence?: Sequence;
  leftClipId?: ClipId;
  rightClipId?: ClipId;
}

/**
 * Text overlay animation types
 */
export type AnimationType = "fade" | "fadeUp" | "fadeDown" | "none";

export interface Animation {
  type: AnimationType;
  durationMs: number;
  easing?: string;
}

/**
 * Text overlay on timeline
 * PR #16 - Text Overlays
 */
export interface Overlay {
  id: string;
  kind: "text";
  content: string;
  font: {
    family: string;
    size: number;
    weight?: number;
    lineHeight?: number;
    letterSpacing?: number;
  };
  fill: string; // hex color (e.g., "#FFFFFF")
  stroke?: {
    color: string;
    width: number;
    opacity?: number;
  };
  bounds: {
    x: number; // normalized 0..1
    y: number; // normalized 0..1
    anchor: "center" | "tl" | "tc" | "tr" | "bl" | "bc" | "br";
  };
  startMs: number; // timeline position
  durationMs: number; // how long overlay appears
  animation?: {
    in?: Animation;
    out?: Animation;
  };
}
