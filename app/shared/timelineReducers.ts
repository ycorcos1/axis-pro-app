/**
 * Timeline Reducers for PR #14 — Pro Timeline
 * @mem ref: pr14-timeline, timeline-reducers
 * Pure functions for timeline editing operations
 * All operations are non-destructive and return new state
 */

import type {
  Sequence,
  Track,
  Clip,
  MediaId,
  ClipId,
  TrackId,
  TransitionKind,
  ClipOperationOptions,
  ClipOperationResult,
  SplitResult,
} from "./timelineTypes.js";

/**
 * Generate a unique clip ID
 */
export function generateClipId(): ClipId {
  return `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sort clips by startMs (ascending)
 */
function sortClips(clips: Clip[]): Clip[] {
  return [...clips].sort((a, b) => a.startMs - b.startMs);
}

/**
 * Check if two clips overlap
 */
function clipsOverlap(clip1: Clip, clip2: Clip): boolean {
  const end1 = clip1.startMs + (clip1.srcOutMs - clip1.srcInMs);
  const end2 = clip2.startMs + (clip2.srcOutMs - clip2.srcInMs);
  return clip1.startMs < end2 && clip2.startMs < end1;
}

/**
 * Get clip duration in milliseconds
 */
export function getClipDuration(clip: Clip): number {
  return clip.srcOutMs - clip.srcInMs;
}

/**
 * Get clip end position on timeline
 */
export function getClipEnd(clip: Clip): number {
  return clip.startMs + getClipDuration(clip);
}

/**
 * Find a track by ID
 */
function findTrack(sequence: Sequence, trackId: TrackId): Track | undefined {
  return sequence.tracks.find((t) => t.id === trackId);
}

/**
 * Find a clip in any track
 */
export function findClip(
  sequence: Sequence,
  clipId: ClipId
): { track: Track; clip: Clip } | undefined {
  for (const track of sequence.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) {
      return { track, clip };
    }
  }
  return undefined;
}

/**
 * Calculate sequence duration (rightmost clip end)
 */
export function calculateSequenceDuration(sequence: Sequence): number {
  let maxEnd = 0;
  for (const track of sequence.tracks) {
    for (const clip of track.clips) {
      const end = getClipEnd(clip);
      if (end > maxEnd) maxEnd = end;
    }
  }
  return maxEnd;
}

/**
 * Apply snapping to a timeline position
 * Snaps to playhead, grid, and clip edges
 */
export function applySnapping(
  targetMs: number,
  sequence: Sequence,
  playheadMs: number | null,
  threshold: number = 100 // ms
): number {
  let bestSnap = targetMs;
  let minDistance = threshold;

  // Snap to playhead
  if (playheadMs !== null) {
    const distance = Math.abs(targetMs - playheadMs);
    if (distance < minDistance) {
      minDistance = distance;
      bestSnap = playheadMs;
    }
  }

  // Snap to grid
  const gridMs = sequence.snapGridMs;
  const nearestGrid = Math.round(targetMs / gridMs) * gridMs;
  const gridDistance = Math.abs(targetMs - nearestGrid);
  if (gridDistance < minDistance) {
    minDistance = gridDistance;
    bestSnap = nearestGrid;
  }

  // Snap to clip edges
  for (const track of sequence.tracks) {
    for (const clip of track.clips) {
      // Snap to start
      const startDistance = Math.abs(targetMs - clip.startMs);
      if (startDistance < minDistance) {
        minDistance = startDistance;
        bestSnap = clip.startMs;
      }

      // Snap to end
      const end = getClipEnd(clip);
      const endDistance = Math.abs(targetMs - end);
      if (endDistance < minDistance) {
        minDistance = endDistance;
        bestSnap = end;
      }
    }
  }

  return bestSnap;
}

/**
 * Add a clip to a track
 */
export function addClip(
  sequence: Sequence,
  trackId: TrackId,
  mediaId: MediaId,
  startMs: number,
  srcInMs: number,
  srcOutMs: number,
  options?: ClipOperationOptions
): { sequence: Sequence; clipId: ClipId } | ClipOperationResult {
  const track = findTrack(sequence, trackId);
  if (!track) {
    return { success: false, error: `Track ${trackId} not found` };
  }

  // Create new clip
  const clipId = generateClipId();
  const newClip: Clip = {
    id: clipId,
    mediaId,
    srcInMs,
    srcOutMs,
    startMs: options?.snap ? applySnapping(startMs, sequence, null) : startMs,
  };

  // Check for overlaps
  for (const existingClip of track.clips) {
    if (clipsOverlap(newClip, existingClip)) {
      return {
        success: false,
        error: "Clip overlaps with existing clip",
      };
    }
  }

  // Add clip and sort
  const updatedClips = sortClips([...track.clips, newClip]);

  // Update track
  const updatedTracks = sequence.tracks.map((t) =>
    t.id === trackId ? { ...t, clips: updatedClips } : t
  );

  const updatedSequence: Sequence = {
    ...sequence,
    tracks: updatedTracks,
    durationMs: calculateSequenceDuration({
      ...sequence,
      tracks: updatedTracks,
    }),
  };

  return { sequence: updatedSequence, clipId };
}

/**
 * Move a clip to a new position
 */
export function moveClip(
  sequence: Sequence,
  clipId: ClipId,
  newStartMs: number,
  options?: ClipOperationOptions
): { sequence: Sequence } | ClipOperationResult {
  const found = findClip(sequence, clipId);
  if (!found) {
    return { success: false, error: `Clip ${clipId} not found` };
  }

  const { track, clip } = found;

  // Apply snapping if requested
  const finalStartMs = options?.snap
    ? applySnapping(newStartMs, sequence, null)
    : newStartMs;

  // Create moved clip
  const movedClip: Clip = {
    ...clip,
    startMs: Math.max(0, finalStartMs),
  };

  // Check for overlaps (excluding this clip)
  for (const existingClip of track.clips) {
    if (existingClip.id !== clipId && clipsOverlap(movedClip, existingClip)) {
      return {
        success: false,
        error: "Move would cause overlap",
      };
    }
  }

  // Update clips
  const updatedClips = sortClips(
    track.clips.map((c) => (c.id === clipId ? movedClip : c))
  );

  // Update track
  const updatedTracks = sequence.tracks.map((t) =>
    t.id === track.id ? { ...t, clips: updatedClips } : t
  );

  // Handle linked clip
  if (clip.linkedTo) {
    const linkedFound = findClip(sequence, clip.linkedTo);
    if (linkedFound) {
      const offset = linkedFound.clip.startMs - clip.startMs;
      const linkedNewStartMs = finalStartMs + offset;

      const linkedMovedClip: Clip = {
        ...linkedFound.clip,
        startMs: Math.max(0, linkedNewStartMs),
      };

      const linkedUpdatedClips = sortClips(
        linkedFound.track.clips.map((c) =>
          c.id === clip.linkedTo ? linkedMovedClip : c
        )
      );

      const finalTracks = updatedTracks.map((t) =>
        t.id === linkedFound.track.id ? { ...t, clips: linkedUpdatedClips } : t
      );

      const updatedSequence: Sequence = {
        ...sequence,
        tracks: finalTracks,
        durationMs: calculateSequenceDuration({
          ...sequence,
          tracks: finalTracks,
        }),
      };

      return { sequence: updatedSequence };
    }
  }

  const updatedSequence: Sequence = {
    ...sequence,
    tracks: updatedTracks,
    durationMs: calculateSequenceDuration({
      ...sequence,
      tracks: updatedTracks,
    }),
  };

  return { sequence: updatedSequence };
}

/**
 * Trim a clip (adjust in or out point)
 */
export function trimClip(
  sequence: Sequence,
  clipId: ClipId,
  edge: "in" | "out",
  deltaMs: number,
  options?: ClipOperationOptions
): { sequence: Sequence } | ClipOperationResult {
  const found = findClip(sequence, clipId);
  if (!found) {
    return { success: false, error: `Clip ${clipId} not found` };
  }

  const { track, clip } = found;

  // Minimum clip duration
  const MIN_DURATION_MS = 100;

  let updatedClip: Clip;

  if (edge === "in") {
    const newSrcIn = clip.srcInMs + deltaMs;
    const newStartMs = clip.startMs + deltaMs;

    // Validate trim doesn't exceed source or create too-short clip
    if (newSrcIn < 0 || newSrcIn >= clip.srcOutMs - MIN_DURATION_MS) {
      return { success: false, error: "Invalid trim range" };
    }

    updatedClip = {
      ...clip,
      srcInMs: newSrcIn,
      startMs: Math.max(0, newStartMs),
    };
  } else {
    // edge === "out"
    const newSrcOut = clip.srcOutMs + deltaMs;

    // Validate trim doesn't exceed source or create too-short clip
    if (newSrcOut <= clip.srcInMs + MIN_DURATION_MS) {
      return { success: false, error: "Invalid trim range" };
    }

    updatedClip = {
      ...clip,
      srcOutMs: newSrcOut,
    };
  }

  // Check for overlaps
  for (const existingClip of track.clips) {
    if (existingClip.id !== clipId && clipsOverlap(updatedClip, existingClip)) {
      return {
        success: false,
        error: "Trim would cause overlap",
      };
    }
  }

  // Update clips
  const updatedClips = sortClips(
    track.clips.map((c) => (c.id === clipId ? updatedClip : c))
  );

  // Update track
  const updatedTracks = sequence.tracks.map((t) =>
    t.id === track.id ? { ...t, clips: updatedClips } : t
  );

  const updatedSequence: Sequence = {
    ...sequence,
    tracks: updatedTracks,
    durationMs: calculateSequenceDuration({
      ...sequence,
      tracks: updatedTracks,
    }),
  };

  return { sequence: updatedSequence };
}

/**
 * Split a clip at a specific timeline position
 */
export function splitClip(
  sequence: Sequence,
  clipId: ClipId,
  atMs: number
): SplitResult {
  const found = findClip(sequence, clipId);
  if (!found) {
    return { success: false, error: `Clip ${clipId} not found` };
  }

  const { track, clip } = found;
  const clipEnd = getClipEnd(clip);

  // Check if split position is within clip
  if (atMs <= clip.startMs || atMs >= clipEnd) {
    return {
      success: false,
      error: "Split position must be within clip bounds",
    };
  }

  // Calculate source offset
  const offsetMs = atMs - clip.startMs;
  const srcSplitPoint = clip.srcInMs + offsetMs;

  // Create left clip (original clip trimmed)
  const leftClip: Clip = {
    ...clip,
    srcOutMs: srcSplitPoint,
  };

  // Create right clip (new clip)
  const rightClipId = generateClipId();
  const rightClip: Clip = {
    id: rightClipId,
    mediaId: clip.mediaId,
    srcInMs: srcSplitPoint,
    srcOutMs: clip.srcOutMs,
    startMs: atMs,
    linkedTo: clip.linkedTo, // Preserve link
  };

  // Update clips (replace original with left, add right)
  const updatedClips = sortClips([
    ...track.clips.filter((c) => c.id !== clipId),
    leftClip,
    rightClip,
  ]);

  // Update track
  const updatedTracks = sequence.tracks.map((t) =>
    t.id === track.id ? { ...t, clips: updatedClips } : t
  );

  const updatedSequence: Sequence = {
    ...sequence,
    tracks: updatedTracks,
    durationMs: calculateSequenceDuration({
      ...sequence,
      tracks: updatedTracks,
    }),
  };

  return {
    success: true,
    sequence: updatedSequence,
    leftClipId: clipId,
    rightClipId,
    affectedClipIds: [clipId, rightClipId],
  };
}

/**
 * Delete a clip
 */
export function deleteClip(
  sequence: Sequence,
  clipId: ClipId,
  options?: ClipOperationOptions
): { sequence: Sequence } | ClipOperationResult {
  const found = findClip(sequence, clipId);
  if (!found) {
    return { success: false, error: `Clip ${clipId} not found` };
  }

  const { track, clip } = found;

  // Remove clip
  let updatedClips = track.clips.filter((c) => c.id !== clipId);

  // Handle ripple delete
  if (options?.ripple) {
    const clipDuration = getClipDuration(clip);
    updatedClips = updatedClips.map((c) => {
      if (c.startMs > clip.startMs) {
        return { ...c, startMs: c.startMs - clipDuration };
      }
      return c;
    });
  }

  // Update track
  let updatedTracks = sequence.tracks.map((t) =>
    t.id === track.id ? { ...t, clips: updatedClips } : t
  );

  // Handle linked clip deletion
  if (clip.linkedTo) {
    const linkedFound = findClip(sequence, clip.linkedTo);
    if (linkedFound) {
      let linkedUpdatedClips = linkedFound.track.clips.filter(
        (c) => c.id !== clip.linkedTo
      );

      // Also ripple the linked track if requested
      if (options?.ripple) {
        const linkedClipDuration = getClipDuration(linkedFound.clip);
        linkedUpdatedClips = linkedUpdatedClips.map((c) => {
          if (c.startMs > linkedFound.clip.startMs) {
            return { ...c, startMs: c.startMs - linkedClipDuration };
          }
          return c;
        });
      }

      updatedTracks = updatedTracks.map((t) =>
        t.id === linkedFound.track.id ? { ...t, clips: linkedUpdatedClips } : t
      );
    }
  }

  const updatedSequence: Sequence = {
    ...sequence,
    tracks: updatedTracks,
    durationMs: calculateSequenceDuration({
      ...sequence,
      tracks: updatedTracks,
    }),
  };

  return { sequence: updatedSequence };
}

/**
 * Add a transition to a clip
 */
export function addTransition(
  sequence: Sequence,
  clipId: ClipId,
  where: "in" | "out",
  kind: TransitionKind,
  durationMs: number
): { sequence: Sequence } | ClipOperationResult {
  const found = findClip(sequence, clipId);
  if (!found) {
    return { success: false, error: `Clip ${clipId} not found` };
  }

  const { track, clip } = found;

  // Validate transition duration
  const clipDuration = getClipDuration(clip);
  if (durationMs > clipDuration / 2) {
    return {
      success: false,
      error: "Transition duration too long for clip",
    };
  }

  // Create transition
  const transition = { kind, durationMs };

  // Update clip
  const updatedClip: Clip = {
    ...clip,
    effects: {
      ...clip.effects,
      [where]: transition,
    },
  };

  // Update clips
  const updatedClips = track.clips.map((c) =>
    c.id === clipId ? updatedClip : c
  );

  // Update track
  const updatedTracks = sequence.tracks.map((t) =>
    t.id === track.id ? { ...t, clips: updatedClips } : t
  );

  const updatedSequence: Sequence = {
    ...sequence,
    tracks: updatedTracks,
  };

  return { sequence: updatedSequence };
}

/**
 * Link two clips (video and audio)
 * @deprecated This function is no longer used. Videos now keep embedded audio
 * as a single clip on the video track. Only kept for backward compatibility.
 */
export function linkClips(
  sequence: Sequence,
  videoClipId: ClipId,
  audioClipId: ClipId
): { sequence: Sequence } | ClipOperationResult {
  const videoFound = findClip(sequence, videoClipId);
  const audioFound = findClip(sequence, audioClipId);

  if (!videoFound || !audioFound) {
    return { success: false, error: "One or both clips not found" };
  }

  // Update both clips to link to each other
  const updatedVideoClip: Clip = {
    ...videoFound.clip,
    linkedTo: audioClipId,
  };

  const updatedAudioClip: Clip = {
    ...audioFound.clip,
    linkedTo: videoClipId,
  };

  // Update tracks
  const updatedTracks = sequence.tracks.map((t) => {
    let clips = t.clips;

    if (t.id === videoFound.track.id) {
      clips = clips.map((c) => (c.id === videoClipId ? updatedVideoClip : c));
    }

    if (t.id === audioFound.track.id) {
      clips = clips.map((c) => (c.id === audioClipId ? updatedAudioClip : c));
    }

    return { ...t, clips };
  });

  const updatedSequence: Sequence = {
    ...sequence,
    tracks: updatedTracks,
  };

  return { sequence: updatedSequence };
}

/**
 * Unlink a clip from its mate
 */
export function unlinkClip(
  sequence: Sequence,
  clipId: ClipId
): { sequence: Sequence } | ClipOperationResult {
  const found = findClip(sequence, clipId);
  if (!found) {
    return { success: false, error: `Clip ${clipId} not found` };
  }

  const { clip } = found;

  if (!clip.linkedTo) {
    return { success: false, error: "Clip is not linked" };
  }

  const linkedClipId = clip.linkedTo;

  // Update both clips to remove link
  const updatedTracks = sequence.tracks.map((t) => ({
    ...t,
    clips: t.clips.map((c) => {
      if (c.id === clipId || c.id === linkedClipId) {
        const { linkedTo, ...rest } = c;
        return rest as Clip;
      }
      return c;
    }),
  }));

  const updatedSequence: Sequence = {
    ...sequence,
    tracks: updatedTracks,
  };

  return { sequence: updatedSequence };
}

/**
 * Create a default empty sequence
 */
export function createDefaultSequence(): Sequence {
  return {
    id: `seq-${Date.now()}`,
    name: "Sequence 1",
    fps: 30,
    resolution: { w: 1920, h: 1080 },
    snapGridMs: 100,
    tracks: [
      { id: "Video", kind: "video", clips: [], visible: true, height: 80 },
      { id: "Audio", kind: "audio", clips: [], visible: true, height: 60 },
    ],
    overlays: [], // Initialize with empty overlays array for text track
    durationMs: 0,
  };
}

/**
 * Add a new track to the sequence
 */
export function addTrack(
  sequence: Sequence,
  kind: "video" | "audio"
): Sequence {
  const existingTracksOfKind = sequence.tracks.filter((t) => t.kind === kind);
  const nextNumber = existingTracksOfKind.length + 1;
  const trackId = `${kind === "video" ? "V" : "A"}${nextNumber}` as TrackId;

  const newTrack: Track = {
    id: trackId,
    kind,
    clips: [],
    visible: true,
    height: kind === "video" ? 80 : 60,
  };

  // Insert video tracks before audio tracks
  const tracks =
    kind === "video"
      ? [
          ...sequence.tracks.filter((t) => t.kind === "video"),
          newTrack,
          ...sequence.tracks.filter((t) => t.kind === "audio"),
        ]
      : [...sequence.tracks, newTrack];

  return {
    ...sequence,
    tracks,
  };
}

/**
 * ===== OVERLAY OPERATIONS (PR #16) =====
 */

import type { Overlay } from "./timelineTypes.js";

/**
 * Generate a unique overlay ID
 */
export function generateOverlayId(): string {
  return `overlay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add a text overlay to the sequence
 */
export function addOverlay(
  sequence: Sequence,
  overlay: Overlay
): { sequence: Sequence; overlayId: string } {
  const overlays = sequence.overlays || [];
  const newOverlays = [...overlays, overlay];

  return {
    sequence: {
      ...sequence,
      overlays: newOverlays,
    },
    overlayId: overlay.id,
  };
}

/**
 * Update an existing overlay
 */
export function updateOverlay(
  sequence: Sequence,
  overlayId: string,
  updates: Partial<Overlay>
): { sequence: Sequence } | ClipOperationResult {
  const overlays = sequence.overlays || [];
  const overlayIndex = overlays.findIndex((o) => o.id === overlayId);

  if (overlayIndex === -1) {
    return { success: false, error: `Overlay ${overlayId} not found` };
  }

  const newOverlays = [...overlays];
  newOverlays[overlayIndex] = {
    ...newOverlays[overlayIndex],
    ...updates,
  };

  return {
    sequence: {
      ...sequence,
      overlays: newOverlays,
    },
  };
}

/**
 * Delete an overlay
 */
export function deleteOverlay(
  sequence: Sequence,
  overlayId: string
): { sequence: Sequence } | ClipOperationResult {
  const overlays = sequence.overlays || [];
  const overlayIndex = overlays.findIndex((o) => o.id === overlayId);

  if (overlayIndex === -1) {
    return { success: false, error: `Overlay ${overlayId} not found` };
  }

  const newOverlays = overlays.filter((o) => o.id !== overlayId);

  return {
    sequence: {
      ...sequence,
      overlays: newOverlays,
    },
  };
}

/**
 * Get overlay by ID
 */
export function findOverlay(
  sequence: Sequence,
  overlayId: string
): Overlay | undefined {
  return (sequence.overlays || []).find((o) => o.id === overlayId);
}

/**
 * Get overlays visible at a specific time
 */
export function getOverlaysAtTime(
  sequence: Sequence,
  timeMs: number
): Overlay[] {
  const overlays = sequence.overlays || [];
  return overlays.filter((o) => {
    const startMs = o.startMs;
    const endMs = o.startMs + o.durationMs;
    return timeMs >= startMs && timeMs < endMs;
  });
}

/**
 * Create a default text overlay at specified position
 */
export function createDefaultTextOverlay(
  startMs: number,
  durationMs: number = 3000
): Overlay {
  return {
    id: generateOverlayId(),
    kind: "text",
    content: "New Text",
    font: {
      family: "Arial",
      size: 48,
      weight: 700,
    },
    fill: "#FFFFFF",
    stroke: {
      color: "#000000",
      width: 2,
      opacity: 0.8,
    },
    bounds: {
      x: 0.5,
      y: 0.85,
      anchor: "center",
    },
    startMs,
    durationMs,
    animation: {
      in: {
        type: "fadeUp",
        durationMs: 300,
      },
      out: {
        type: "fade",
        durationMs: 300,
      },
    },
  };
}
