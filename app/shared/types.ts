/**
 * Shared TypeScript types for IPC communication
 * @mem ref: ipc-surface, pr9-dashboard, pr14-timeline
 * Contract between main and renderer processes
 */

// Import timeline types for project model
import type {
  Sequence,
  MediaInfo as TimelineMediaInfo,
} from "./timelineTypes.js";

/**
 * Project data model with timeline support (PR #14)
 */
export interface Project {
  id: string;
  title: string;
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  fps: number; // base timeline fps

  // Legacy single-clip fields (for backward compatibility)
  clips?: Record<string, ProjectClip>;
  segments?: Segment[]; // V1 single track

  // New timeline fields (PR #14)
  media?: Record<string, TimelineMediaInfo>;
  sequence?: Sequence;

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

/**
 * Recording source type
 */
export type RecordingSourceType = "screen" | "window";

/**
 * Desktop capture source (screen or window)
 */
export interface DesktopSource {
  id: string;
  name: string;
  type: RecordingSourceType;
  thumbnail?: string; // base64 data URL
}

/**
 * Recording configuration
 */
export interface RecordingConfig {
  sourceId: string; // screen or window ID
  sourceType: RecordingSourceType;
  enableWebcam: boolean;
  enableMicrophone: boolean;
  webcamDeviceId?: string;
  micDeviceId?: string;
}

/**
 * Recording state during capture
 */
export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  durationMs: number;
  outputPath?: string;
}

/**
 * Result from recording operation
 */
export interface RecordingResult {
  success: boolean;
  outputPath?: string;
  durationMs?: number;
  error?: string;
}

/**
 * AI Shorts Generation Types (PR #17)
 * @mem ref: pr17-ai-shorts
 */

/**
 * Individual AI-generated short clip
 */
export interface AIShort {
  id: string; // e.g., "short-1"
  projectId: string; // parent project ID
  startMs: number; // start time in source video
  endMs: number; // end time in source video
  durationMs: number; // duration of the short
  caption: string; // AI-generated caption text
  videoPath: string; // path to rendered MP4
  srtPath: string; // path to subtitle file
  jsonPath: string; // path to metadata JSON
  thumbnailPath?: string; // path to thumbnail
  createdAt: number; // timestamp
}

/**
 * AI Shorts generation job status
 */
export type AIShortsJobStatus =
  | "idle"
  | "transcribing"
  | "segmenting"
  | "rendering"
  | "complete"
  | "error";

/**
 * AI Shorts generation job progress
 */
export interface AIShortsJobProgress {
  status: AIShortsJobStatus;
  message: string;
  progress: number; // 0-100
  currentShort?: number; // current short being rendered (1-based)
  totalShorts?: number; // total shorts to render
}

/**
 * AI Shorts generation result
 */
export interface AIShortsResult {
  success: boolean;
  shorts: AIShort[];
  error?: string;
}

/**
 * Transcript segment from Whisper
 */
export interface TranscriptSegment {
  text: string;
  start: number; // seconds
  end: number; // seconds
}

/**
 * Word-level timestamp from Whisper
 * Provides precise timing for individual words
 */
export interface WordTimestamp {
  text: string;
  start: number; // seconds
  end: number; // seconds
}

/**
 * GPT-suggested highlight segment
 */
export interface HighlightSegment {
  startMs: number;
  endMs: number;
  caption: string;
  reasoning?: string; // why this segment was selected
  hookScore?: number; // 1-10 rating of opening hook strength
  retentionScore?: number; // 1-10 rating of viewer retention potential
}
