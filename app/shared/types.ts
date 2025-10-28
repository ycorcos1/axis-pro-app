/**
 * Shared TypeScript types for IPC communication
 * @mem ref: ipc-surface, pr9-dashboard
 * Contract between main and renderer processes
 */

/**
 * Project data model per PRD v2
 */
export interface Project {
  id: string;
  title: string;
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  fps: number; // base timeline fps
  clips: Record<string, ProjectClip>;
  segments: Segment[]; // V1 single track
  previewThumbPath?: string;
  stats?: {
    durationMs?: number;
    resolution?: string;
    clipCount?: number;
  };
}

/**
 * Clip data stored in project (differs from imported Clip in editing screen)
 */
export interface ProjectClip {
  id: string;
  path: string; // absolute
  durationMs: number;
  width: number;
  height: number;
  fps?: number;
  audioChannels?: number;
}

/**
 * Timeline segment
 */
export interface Segment {
  id: string;
  clipId: string;
  inMs: number;
  outMs: number;
  startMs: number; // position on timeline
}

/**
 * Represents an imported media clip (used in editing screen)
 */
export interface Clip {
  id: string;
  path: string;
  filename: string;
  duration: number; // in milliseconds
  width: number;
  height: number;
  inMs: number; // trim in point (default 0)
  outMs: number; // trim out point (default duration)
  thumbnailUrl?: string;
}

/**
 * Media metadata from ffprobe
 */
export interface MediaInfo {
  path: string;
  duration: number; // milliseconds
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate: number;
}

/**
 * Timeline segment for export
 */
export interface TimelineSegment {
  clipPath: string;
  inMs: number;
  outMs: number;
}

/**
 * Export configuration options
 */
export interface ExportOptions {
  codec?: string; // default: 'copy'
  preset?: string; // default: 'fast'
  crf?: number; // quality for re-encode
}

/**
 * Result from export operation
 */
export interface ExportResult {
  success: boolean;
  outputPath: string;
  error?: string;
  duration?: number; // export duration in ms
}

/**
 * Project metadata for dashboard display
 */
export interface ProjectMetadata {
  id: string;
  title: string;
  updatedAt: number;
  stats?: {
    durationMs?: number;
    resolution?: string;
    clipCount?: number;
  };
  previewThumbPath?: string;
}
