/**
 * Export Builder for PR #14 — Pro Timeline + PR #16 — Text Overlays
 * @mem ref: pr14-timeline, ffmpeg-export, pr16-text-overlays
 * Builds FFmpeg filtergraph from Sequence with overlay support
 */

import type {
  Sequence,
  Track,
  Clip,
  MediaInfo,
  Overlay,
} from "./timelineTypes.js";
import { getClipDuration, getClipEnd } from "./timelineReducers.js";

/**
 * Generate FFmpeg command arguments for exporting a sequence
 * Builds a filtergraph that handles multi-track, transitions, and overlays
 */
export function buildExportCommand(
  sequence: Sequence,
  media: Record<string, MediaInfo>,
  outputPath: string
): string[] {
  // Check if we can use FAST PATH (stream copy without re-encoding)
  const canUseFastPath = checkFastPathEligibility(sequence, media);

  if (canUseFastPath) {
    console.log(
      "[ExportBuilder] Using FAST PATH (stream copy, instant export)"
    );
    return buildFastPathCommand(sequence, media, outputPath);
  } else {
    console.log("[ExportBuilder] Using QUALITY PATH (re-encoding, slower)");
    return buildQualityPathCommand(sequence, media, outputPath);
  }
}

/**
 * Check if timeline can use fast path (stream copy)
 * Fast path requirements:
 * - Single video track, single audio track
 * - No gaps in timeline (clips are contiguous)
 * - All clips have same codec, resolution, fps
 * - No overlays or multiple tracks
 */
function checkFastPathEligibility(
  sequence: Sequence,
  media: Record<string, MediaInfo>
): boolean {
  const videoTracks = sequence.tracks.filter(
    (t) => t.kind === "video" && t.visible
  );
  const audioTracks = sequence.tracks.filter(
    (t) => t.kind === "audio" && !t.muted
  );

  // Must have exactly 1 video track (or 0) and 1 audio track (or 0)
  if (videoTracks.length > 1 || audioTracks.length > 1) return false;

  // Cannot use fast path if there are overlays (PR #16)
  if (sequence.overlays && sequence.overlays.length > 0) return false;

  // Check if all clips are from same source (same codec/res/fps)
  const allClips = [...videoTracks, ...audioTracks].flatMap((t) => t.clips);
  if (allClips.length === 0) return false;

  const firstMedia = media[allClips[0].mediaId];
  if (!firstMedia) return false;

  // All clips must have matching properties
  for (const clip of allClips) {
    const clipMedia = media[clip.mediaId];
    if (!clipMedia) return false;

    // Check resolution/fps match for video
    if (videoTracks.length > 0 && firstMedia.streams.v && clipMedia.streams.v) {
      if (
        firstMedia.streams.v.w !== clipMedia.streams.v.w ||
        firstMedia.streams.v.h !== clipMedia.streams.v.h ||
        firstMedia.streams.v.fps !== clipMedia.streams.v.fps
      ) {
        return false;
      }
    }
  }

  // Check for gaps (clips must be contiguous)
  if (videoTracks.length > 0) {
    const clips = [...videoTracks[0].clips].sort(
      (a, b) => a.startMs - b.startMs
    );
    if (clips[0].startMs > 100) return false; // Gap at start (allow 100ms tolerance)

    for (let i = 1; i < clips.length; i++) {
      const prevEnd =
        clips[i - 1].startMs + (clips[i - 1].srcOutMs - clips[i - 1].srcInMs);
      if (Math.abs(clips[i].startMs - prevEnd) > 100) return false; // Gap detected
    }
  }

  return true;
}

/**
 * FAST PATH: Stream copy without re-encoding
 * This approach uses segment-based concatenation
 */
function buildFastPathCommand(
  sequence: Sequence,
  media: Record<string, MediaInfo>,
  outputPath: string
): string[] {
  const args: string[] = [];

  // Get the clips to concatenate
  const videoTrack = sequence.tracks.find(
    (t) => t.kind === "video" && t.visible
  );
  const audioTrack = sequence.tracks.find(
    (t) => t.kind === "audio" && !t.muted
  );

  const clips = videoTrack ? videoTrack.clips : audioTrack!.clips;
  const sortedClips = [...clips].sort((a, b) => a.startMs - b.startMs);

  // If only one clip, just extract with stream copy (INSTANT)
  if (sortedClips.length === 1) {
    const clip = sortedClips[0];
    const mediaInfo = media[clip.mediaId];
    if (!mediaInfo) return args;

    const startSec = clip.srcInMs / 1000;
    const endSec = clip.srcOutMs / 1000;

    args.push(
      "-ss",
      startSec.toFixed(3),
      "-to",
      endSec.toFixed(3),
      "-i",
      mediaInfo.path,
      "-c",
      "copy", // Stream copy - no re-encoding!
      "-movflags",
      "faststart",
      "-y",
      outputPath
    );

    console.log("[ExportBuilder] FAST PATH (single clip, stream copy):", args);
    return args;
  }

  // Multiple clips: use hardware-accelerated encoding (still fast)
  for (const clip of sortedClips) {
    const mediaInfo = media[clip.mediaId];
    if (!mediaInfo) continue;
    args.push("-i", mediaInfo.path);
  }

  // Build concat filter with trimming
  const filterParts: string[] = [];
  for (let i = 0; i < sortedClips.length; i++) {
    const clip = sortedClips[i];
    const startSec = clip.srcInMs / 1000;
    const endSec = clip.srcOutMs / 1000;

    if (videoTrack && audioTrack) {
      filterParts.push(
        `[${i}:v]trim=start=${startSec}:end=${endSec},setpts=PTS-STARTPTS[v${i}]`,
        `[${i}:a]atrim=start=${startSec}:end=${endSec},asetpts=PTS-STARTPTS[a${i}]`
      );
    } else if (videoTrack) {
      filterParts.push(
        `[${i}:v]trim=start=${startSec}:end=${endSec},setpts=PTS-STARTPTS[v${i}]`
      );
    } else {
      filterParts.push(
        `[${i}:a]atrim=start=${startSec}:end=${endSec},asetpts=PTS-STARTPTS[a${i}]`
      );
    }
  }

  // Concat all trimmed segments
  const vInputs = sortedClips.map((_, i) => `[v${i}]`).join("");
  const aInputs = sortedClips.map((_, i) => `[a${i}]`).join("");

  if (videoTrack && audioTrack) {
    filterParts.push(
      `${vInputs}concat=n=${sortedClips.length}:v=1:a=0[outv]`,
      `${aInputs}concat=n=${sortedClips.length}:v=0:a=1[outa]`
    );
  } else if (videoTrack) {
    filterParts.push(`${vInputs}concat=n=${sortedClips.length}:v=1:a=0[outv]`);
  } else {
    filterParts.push(`${aInputs}concat=n=${sortedClips.length}:v=0:a=1[outa]`);
  }

  args.push("-filter_complex", filterParts.join(";"));

  if (videoTrack) args.push("-map", "[outv]");
  if (audioTrack) args.push("-map", "[outa]");

  // Hardware encoding (fast)
  if (process.platform === "darwin") {
    args.push("-c:v", "h264_videotoolbox", "-b:v", "10000k", "-allow_sw", "1");
  } else {
    args.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", "28");
  }

  if (audioTrack) args.push("-c:a", "aac", "-b:a", "192k");

  args.push("-movflags", "faststart", "-y", outputPath);

  console.log("[ExportBuilder] FAST PATH (multi-clip, hardware encode):", args);
  return args;
}

/**
 * QUALITY PATH: Full filtergraph with re-encoding
 * Use this when fast path isn't possible
 */
function buildQualityPathCommand(
  sequence: Sequence,
  media: Record<string, MediaInfo>,
  outputPath: string
): string[] {
  const args: string[] = [];

  // Collect all input files (deduplicated)
  const inputFiles = new Map<string, number>(); // mediaId -> input index
  let inputIndex = 0;

  // Add all unique media files as inputs
  for (const track of sequence.tracks) {
    for (const clip of track.clips) {
      const mediaInfo = media[clip.mediaId];
      if (!mediaInfo) continue;

      if (!inputFiles.has(clip.mediaId)) {
        args.push("-i", mediaInfo.path);
        inputFiles.set(clip.mediaId, inputIndex);
        inputIndex++;
      }
    }
  }

  // Build filtergraph
  const filterComplex: string[] = [];
  let labelCounter = 0;

  const getLabel = () => `v${labelCounter++}`;

  /**
   * Get font file path for common fonts on macOS
   * Maps font family names to their actual file paths
   */
  const getFontFilePath = (fontFamily: string): string => {
    // Map of font families to their actual file paths on macOS
    const fontPaths: Record<string, string> = {
      Arial: "/System/Library/Fonts/Supplemental/Arial.ttf",
      Helvetica: "/System/Library/Fonts/Helvetica.ttc",
      "Times New Roman":
        "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
      Georgia: "/System/Library/Fonts/Supplemental/Georgia.ttf",
      "Courier New": "/System/Library/Fonts/Supplemental/Courier New.ttf",
      Verdana: "/System/Library/Fonts/Supplemental/Verdana.ttf",
      Impact: "/System/Library/Fonts/Supplemental/Impact.ttf",
    };

    return (
      fontPaths[fontFamily] ||
      `/System/Library/Fonts/Supplemental/${fontFamily}.ttf`
    );
  };

  /**
   * Build FFmpeg drawtext filter string for an overlay
   * PR #16 - Text Overlays
   */
  const buildDrawtextFilter = (
    overlay: Overlay,
    videoWidth: number,
    videoHeight: number
  ): string => {
    if (overlay.kind !== "text") return "";

    // Escape text for FFmpeg
    const escapedText = overlay.content
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/:/g, "\\:")
      .replace(/\n/g, "\\n");

    // Calculate absolute position from normalized bounds
    let x: string;
    let y: string;

    switch (overlay.bounds.anchor) {
      case "center":
        x = `(w-text_w)/2`;
        y = `(h-text_h)/2`;
        break;
      case "tl":
        x = `${overlay.bounds.x * videoWidth}`;
        y = `${overlay.bounds.y * videoHeight}`;
        break;
      case "tc":
        // Top Center
        x = `(w-text_w)/2`;
        y = `${overlay.bounds.y * videoHeight}`;
        break;
      case "tr":
        x = `w-text_w-${(1 - overlay.bounds.x) * videoWidth}`;
        y = `${overlay.bounds.y * videoHeight}`;
        break;
      case "bl":
        x = `${overlay.bounds.x * videoWidth}`;
        y = `h-text_h-${(1 - overlay.bounds.y) * videoHeight}`;
        break;
      case "bc":
        // Bottom Center
        x = `(w-text_w)/2`;
        y = `h-text_h-${(1 - overlay.bounds.y) * videoHeight}`;
        break;
      case "br":
        x = `w-text_w-${(1 - overlay.bounds.x) * videoWidth}`;
        y = `h-text_h-${(1 - overlay.bounds.y) * videoHeight}`;
        break;
      default:
        // Default to center with percentage
        x = `${overlay.bounds.x * videoWidth}`;
        y = `${overlay.bounds.y * videoHeight}`;
    }

    // Convert color from hex to FFmpeg format (remove #)
    const fontColor = overlay.fill.replace("#", "");
    const strokeColor = overlay.stroke?.color.replace("#", "") || "000000";
    const strokeWidth = overlay.stroke?.width || 0;

    // Calculate time bounds in seconds
    const startSec = overlay.startMs / 1000;
    const endSec = (overlay.startMs + overlay.durationMs) / 1000;

    // Build base drawtext options with proper font path
    const options = [
      `text='${escapedText}'`,
      `fontfile=${getFontFilePath(overlay.font.family)}`,
      `fontsize=${overlay.font.size}`,
      `fontcolor=0x${fontColor}`,
      `x=${x}`,
      `y=${y}`,
    ];

    // Add stroke/border if specified
    if (strokeWidth > 0) {
      options.push(`borderw=${strokeWidth}`);
      options.push(`bordercolor=0x${strokeColor}`);
    }

    // Add timing enable expression
    options.push(`enable='between(t,${startSec},${endSec})'`);

    // Add fade animations if specified
    if (overlay.animation?.in || overlay.animation?.out) {
      const fadeInDur = (overlay.animation?.in?.durationMs || 0) / 1000;
      const fadeOutDur = (overlay.animation?.out?.durationMs || 0) / 1000;
      const fadeOutStart = endSec - fadeOutDur;

      let alphaExpr = "1";

      if (fadeInDur > 0 && fadeOutDur > 0) {
        // Both fade in and out
        alphaExpr = `if(lt(t,${
          startSec + fadeInDur
        }),(t-${startSec})/${fadeInDur},if(gt(t,${fadeOutStart}),(${endSec}-t)/${fadeOutDur},1))`;
      } else if (fadeInDur > 0) {
        // Only fade in
        alphaExpr = `if(lt(t,${
          startSec + fadeInDur
        }),(t-${startSec})/${fadeInDur},1)`;
      } else if (fadeOutDur > 0) {
        // Only fade out
        alphaExpr = `if(gt(t,${fadeOutStart}),(${endSec}-t)/${fadeOutDur},1)`;
      }

      options.push(`alpha='${alphaExpr}'`);
    }

    return `drawtext=${options.join(":")}`;
  };

  // Process video tracks - WITH TIMELINE POSITION HANDLING
  const videoTracks = sequence.tracks.filter(
    (t) => t.kind === "video" && t.visible
  );
  const videoLabels: string[] = [];

  for (const track of videoTracks) {
    if (track.clips.length === 0) continue;

    // Sort clips by timeline position
    const sortedClips = [...track.clips].sort((a, b) => a.startMs - b.startMs);
    const trackParts: string[] = []; // Parts to concatenate (clips + gaps)

    let currentTimelinePos = 0; // Track timeline position

    for (let i = 0; i < sortedClips.length; i++) {
      const clip = sortedClips[i];
      const mediaInfo = media[clip.mediaId];
      if (!mediaInfo || !mediaInfo.streams.v) continue;

      const inputIdx = inputFiles.get(clip.mediaId);
      if (inputIdx === undefined) continue;

      // Check if there's a gap before this clip
      if (clip.startMs > currentTimelinePos) {
        const gapDurationSec = (clip.startMs - currentTimelinePos) / 1000;
        const gapLabel = getLabel();

        // Create black frame for gap with SAR 1:1
        filterComplex.push(
          `color=c=black:s=${sequence.resolution.w}x${sequence.resolution.h}:` +
            `r=${sequence.fps}:d=${gapDurationSec},setsar=1[${gapLabel}]`
        );
        trackParts.push(gapLabel);
      }

      // Process the clip - OPTIMIZED: Remove unnecessary scale/pad if already correct size
      const startSec = clip.srcInMs / 1000;
      const endSec = clip.srcOutMs / 1000;
      const clipDurationMs = clip.srcOutMs - clip.srcInMs;

      const clipLabel = getLabel();

      // Check if scaling is needed
      const needsScaling =
        mediaInfo.streams.v.w !== sequence.resolution.w ||
        mediaInfo.streams.v.h !== sequence.resolution.h;

      if (needsScaling) {
        // Only scale if dimensions don't match
        filterComplex.push(
          `[${inputIdx}:v]trim=start=${startSec}:end=${endSec},setpts=PTS-STARTPTS,` +
            `scale=${sequence.resolution.w}:${sequence.resolution.h}:force_original_aspect_ratio=decrease,` +
            `pad=${sequence.resolution.w}:${sequence.resolution.h}:(ow-iw)/2:(oh-ih)/2,` +
            `setsar=1,` + // Normalize SAR to 1:1 to avoid mismatch errors
            `fps=${sequence.fps}[${clipLabel}]` // Force consistent framerate
        );
      } else {
        // Skip scaling for matching dimensions (MUCH faster)
        filterComplex.push(
          `[${inputIdx}:v]trim=start=${startSec}:end=${endSec},setpts=PTS-STARTPTS,` +
            `setsar=1,` + // Normalize SAR to 1:1 to avoid mismatch errors
            `fps=${sequence.fps}[${clipLabel}]`
        );
      }

      trackParts.push(clipLabel);

      // Update timeline position
      currentTimelinePos = clip.startMs + clipDurationMs;
    }

    // Concatenate all parts (clips + gaps) for this track
    if (trackParts.length > 0) {
      if (trackParts.length === 1) {
        videoLabels.push(trackParts[0]);
      } else {
        const concatLabel = getLabel();
        filterComplex.push(
          `${trackParts.map((l) => `[${l}]`).join("")}concat=n=${
            trackParts.length
          }:v=1:a=0[${concatLabel}]`
        );
        videoLabels.push(concatLabel);
      }
    }
  }

  // Overlay video tracks (V2 over V1, etc.)
  let finalVideoLabel = "";
  if (videoLabels.length > 0) {
    if (videoLabels.length === 1) {
      finalVideoLabel = videoLabels[0];
    } else {
      // Overlay V2 over V1, etc.
      let currentLabel = videoLabels[0];
      for (let i = 1; i < videoLabels.length; i++) {
        const overlayLabel = getLabel();
        filterComplex.push(
          `[${currentLabel}][${videoLabels[i]}]overlay=0:0[${overlayLabel}]`
        );
        currentLabel = overlayLabel;
      }
      finalVideoLabel = currentLabel;
    }

    // Apply text overlays (PR #16)
    if (sequence.overlays && sequence.overlays.length > 0) {
      const textOverlays = sequence.overlays.filter((o) => o.kind === "text");
      if (textOverlays.length > 0) {
        // Apply all drawtext filters in sequence
        let currentVideoLabel = finalVideoLabel;
        for (const overlay of textOverlays) {
          const drawtextFilter = buildDrawtextFilter(
            overlay,
            sequence.resolution.w,
            sequence.resolution.h
          );
          if (drawtextFilter) {
            const nextLabel = getLabel();
            filterComplex.push(
              `[${currentVideoLabel}]${drawtextFilter}[${nextLabel}]`
            );
            currentVideoLabel = nextLabel;
          }
        }
        finalVideoLabel = currentVideoLabel;
      }
    }
  }

  // Process audio tracks - WITH TIMELINE POSITION HANDLING
  // UPDATED: Now includes audio from video clips on video tracks
  const audioTracks = sequence.tracks.filter(
    (t) => t.kind === "audio" && !t.muted
  );

  // Also extract audio from video tracks (embedded audio)
  const videoTracksWithAudio = sequence.tracks.filter(
    (t) => t.kind === "video" && t.visible
  );

  const audioLabels: string[] = [];

  // Process audio-only tracks first
  for (const track of audioTracks) {
    if (track.clips.length === 0) continue;

    // Sort clips by timeline position
    const sortedClips = [...track.clips].sort((a, b) => a.startMs - b.startMs);
    const trackParts: string[] = []; // Parts to concatenate (clips + gaps)

    let currentTimelinePos = 0; // Track timeline position

    for (let i = 0; i < sortedClips.length; i++) {
      const clip = sortedClips[i];
      const mediaInfo = media[clip.mediaId];
      if (!mediaInfo || !mediaInfo.streams.a) continue;

      const inputIdx = inputFiles.get(clip.mediaId);
      if (inputIdx === undefined) continue;

      // Check if there's a gap before this clip
      if (clip.startMs > currentTimelinePos) {
        const gapDurationSec = (clip.startMs - currentTimelinePos) / 1000;
        const gapLabel = getLabel();

        // Create silence for gap
        filterComplex.push(
          `aevalsrc=0:d=${gapDurationSec}:s=48000:c=stereo[${gapLabel}]`
        );
        trackParts.push(gapLabel);
      }

      // Process the clip
      const startSec = clip.srcInMs / 1000;
      const endSec = clip.srcOutMs / 1000;
      const clipDurationMs = clip.srcOutMs - clip.srcInMs;

      const clipLabel = getLabel();
      filterComplex.push(
        `[${inputIdx}:a]atrim=start=${startSec}:end=${endSec},asetpts=PTS-STARTPTS[${clipLabel}]`
      );

      trackParts.push(clipLabel);

      // Update timeline position
      currentTimelinePos = clip.startMs + clipDurationMs;
    }

    // Concatenate all parts (clips + gaps) for this track
    if (trackParts.length > 0) {
      if (trackParts.length === 1) {
        audioLabels.push(trackParts[0]);
      } else {
        const concatLabel = getLabel();
        filterComplex.push(
          `${trackParts.map((l) => `[${l}]`).join("")}concat=n=${
            trackParts.length
          }:v=0:a=1[${concatLabel}]`
        );
        audioLabels.push(concatLabel);
      }
    }
  }

  // Process embedded audio from video tracks
  for (const track of videoTracksWithAudio) {
    if (track.clips.length === 0) continue;

    // Sort clips by timeline position
    const sortedClips = [...track.clips].sort((a, b) => a.startMs - b.startMs);
    const trackParts: string[] = []; // Parts to concatenate (clips + gaps)

    let currentTimelinePos = 0; // Track timeline position

    for (let i = 0; i < sortedClips.length; i++) {
      const clip = sortedClips[i];
      const mediaInfo = media[clip.mediaId];
      // Only process if this video has an audio stream
      if (!mediaInfo || !mediaInfo.streams.a) continue;

      const inputIdx = inputFiles.get(clip.mediaId);
      if (inputIdx === undefined) continue;

      // Check if there's a gap before this clip
      if (clip.startMs > currentTimelinePos) {
        const gapDurationSec = (clip.startMs - currentTimelinePos) / 1000;
        const gapLabel = getLabel();

        // Create silence for gap
        filterComplex.push(
          `aevalsrc=0:d=${gapDurationSec}:s=48000:c=stereo[${gapLabel}]`
        );
        trackParts.push(gapLabel);
      }

      // Process the clip's audio stream
      const startSec = clip.srcInMs / 1000;
      const endSec = clip.srcOutMs / 1000;
      const clipDurationMs = clip.srcOutMs - clip.srcInMs;

      const clipLabel = getLabel();
      filterComplex.push(
        `[${inputIdx}:a]atrim=start=${startSec}:end=${endSec},asetpts=PTS-STARTPTS[${clipLabel}]`
      );

      trackParts.push(clipLabel);

      // Update timeline position
      currentTimelinePos = clip.startMs + clipDurationMs;
    }

    // Concatenate all parts (clips + gaps) for this track
    if (trackParts.length > 0) {
      if (trackParts.length === 1) {
        audioLabels.push(trackParts[0]);
      } else {
        const concatLabel = getLabel();
        filterComplex.push(
          `${trackParts.map((l) => `[${l}]`).join("")}concat=n=${
            trackParts.length
          }:v=0:a=1[${concatLabel}]`
        );
        audioLabels.push(concatLabel);
      }
    }
  }

  // Mix audio tracks
  let finalAudioLabel = "";
  if (audioLabels.length > 0) {
    if (audioLabels.length === 1) {
      finalAudioLabel = audioLabels[0];
    } else {
      const mixLabel = getLabel();
      filterComplex.push(
        `${audioLabels.map((l) => `[${l}]`).join("")}amix=inputs=${
          audioLabels.length
        }:duration=longest[${mixLabel}]`
      );
      finalAudioLabel = mixLabel;
    }
  }

  // Add filter_complex to args
  if (filterComplex.length > 0) {
    args.push("-filter_complex", filterComplex.join(";"));
  }

  // Map outputs
  if (finalVideoLabel) {
    args.push("-map", `[${finalVideoLabel}]`);
  }
  if (finalAudioLabel) {
    args.push("-map", `[${finalAudioLabel}]`);
  }

  // Encoding settings - MAXIMUM SPEED
  // Hardware acceleration on macOS (VideoToolbox)
  if (process.platform === "darwin") {
    args.push(
      "-c:v",
      "h264_videotoolbox", // Hardware encoder (much faster!)
      "-b:v",
      "8000k", // Higher bitrate for better quality with hardware
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "faststart",
      "-allow_sw",
      "1" // Fallback to software if hardware fails
    );
  } else {
    // Fallback to software encoder with FASTEST preset
    args.push(
      "-c:v",
      "libx264",
      "-preset",
      "veryfast", // Balance of speed and quality
      "-tune",
      "fastdecode", // Optimize for playback
      "-crf",
      "26", // Better quality than 28
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "faststart",
      "-threads",
      "0", // Use all CPU cores
      "-x264opts",
      "rc-lookahead=10" // Reduce lookahead for speed
    );
  }

  if (finalAudioLabel) {
    args.push(
      "-c:a",
      "aac",
      "-b:a",
      "192k", // Better audio quality
      "-ar",
      "48000",
      "-ac",
      "2"
    );
  }

  // Output file (overwrite without asking)
  args.push("-y", outputPath);

  console.log("[ExportBuilder] QUALITY PATH args:", args);

  return args;
}

/**
 * Estimate export duration based on sequence length
 */
export function estimateExportDuration(sequence: Sequence): number {
  return sequence.durationMs;
}
