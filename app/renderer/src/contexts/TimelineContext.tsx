/**
 * Timeline Context for PR #14 & #15
 * @mem ref: pr14-timeline, pr15-undo-redo
 * Manages timeline state and operations with undo/redo support
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import type {
  Sequence,
  MediaInfo as TimelineMediaInfo,
  Clip as TimelineClip,
} from "../../../shared/timelineTypes";
import * as timelineReducers from "../../../shared/timelineReducers";
import { HistoryService, ActionType } from "../../../shared/historyService";

interface TimelineContextType {
  sequence: Sequence;
  media: Record<string, TimelineMediaInfo>;
  playheadMs: number;
  setPlayheadMs: (ms: number) => void;
  addMediaToTimeline: (
    mediaInfo: TimelineMediaInfo,
    trackId: string,
    startMs?: number
  ) => void;
  updateSequence: (
    sequence: Sequence,
    actionType?: ActionType,
    description?: string
  ) => void;
  updateSequenceNoHistory: (sequence: Sequence) => void;
  addMedia: (mediaInfo: TimelineMediaInfo) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const TimelineContext = createContext<TimelineContextType | null>(null);

export const useTimeline = () => {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error("useTimeline must be used within TimelineProvider");
  }
  return context;
};

interface TimelineProviderProps {
  children: React.ReactNode;
  initialSequence?: Sequence;
  initialMedia?: Record<string, TimelineMediaInfo>;
  onSequenceChange?: (sequence: Sequence) => void;
  onMediaChange?: (media: Record<string, TimelineMediaInfo>) => void;
}

export const TimelineProvider: React.FC<TimelineProviderProps> = ({
  children,
  initialSequence,
  initialMedia = {},
  onSequenceChange,
  onMediaChange,
}) => {
  const [sequence, setSequence] = useState<Sequence>(
    initialSequence || timelineReducers.createDefaultSequence()
  );
  const [media, setMedia] =
    useState<Record<string, TimelineMediaInfo>>(initialMedia);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // History service ref
  const historyServiceRef = useRef<HistoryService | null>(null);

  // Initialize history service
  useEffect(() => {
    if (!historyServiceRef.current) {
      historyServiceRef.current = new HistoryService(
        initialSequence || timelineReducers.createDefaultSequence(),
        { maxStackSize: 50, enableLogging: true }
      );
      setCanUndo(historyServiceRef.current.canUndo());
      setCanRedo(historyServiceRef.current.canRedo());
    }
  }, [initialSequence]);

  // Update history service when sequence changes externally
  useEffect(() => {
    if (historyServiceRef.current && initialSequence) {
      historyServiceRef.current.setCurrentSequence(initialSequence);
    }
  }, [initialSequence]);

  const updateSequence = useCallback(
    (newSequence: Sequence, actionType?: ActionType, description?: string) => {
      if (historyServiceRef.current) {
        const beforeSequence = sequence;
        historyServiceRef.current.pushAction(
          actionType || "batch",
          beforeSequence,
          newSequence,
          description
        );
        setCanUndo(historyServiceRef.current.canUndo());
        setCanRedo(historyServiceRef.current.canRedo());
      }

      setSequence(newSequence);
      if (onSequenceChange) {
        onSequenceChange(newSequence);
      }
    },
    [sequence, onSequenceChange]
  );

  const updateSequenceNoHistory = useCallback(
    (newSequence: Sequence) => {
      setSequence(newSequence);
      if (historyServiceRef.current) {
        historyServiceRef.current.setCurrentSequence(newSequence);
      }
      if (onSequenceChange) {
        onSequenceChange(newSequence);
      }
    },
    [onSequenceChange]
  );

  const undo = useCallback(() => {
    if (historyServiceRef.current) {
      const restoredSequence = historyServiceRef.current.undo();
      if (restoredSequence) {
        setSequence(restoredSequence);
        if (onSequenceChange) {
          onSequenceChange(restoredSequence);
        }
        setCanUndo(historyServiceRef.current.canUndo());
        setCanRedo(historyServiceRef.current.canRedo());
      }
    }
  }, [onSequenceChange]);

  const redo = useCallback(() => {
    if (historyServiceRef.current) {
      const restoredSequence = historyServiceRef.current.redo();
      if (restoredSequence) {
        setSequence(restoredSequence);
        if (onSequenceChange) {
          onSequenceChange(restoredSequence);
        }
        setCanUndo(historyServiceRef.current.canUndo());
        setCanRedo(historyServiceRef.current.canRedo());
      }
    }
  }, [onSequenceChange]);

  const addMedia = useCallback(
    (mediaInfo: TimelineMediaInfo) => {
      const newMedia = { ...media, [mediaInfo.id]: mediaInfo };
      setMedia(newMedia);
      if (onMediaChange) {
        onMediaChange(newMedia);
      }
    },
    [media, onMediaChange]
  );

  const addMediaToTimeline = useCallback(
    (
      mediaInfo: TimelineMediaInfo,
      trackId: string,
      startMs: number = playheadMs
    ) => {
      // Add media if not already in library
      if (!media[mediaInfo.id]) {
        addMedia(mediaInfo);
      }

      // Determine clip source in/out based on media duration
      const srcInMs = 0;
      const srcOutMs = mediaInfo.durationMs;

      // Add clip to track
      const result = timelineReducers.addClip(
        sequence,
        trackId,
        mediaInfo.id,
        startMs,
        srcInMs,
        srcOutMs,
        { snap: true }
      );

      if ("sequence" in result) {
        updateSequence(result.sequence, "add-clip", `Add clip ${mediaInfo.id}`);
        return result.clipId;
      } else {
        console.error("Failed to add clip:", result.error);
        return null;
      }
    },
    [sequence, media, playheadMs, addMedia, updateSequence]
  );

  const value: TimelineContextType = {
    sequence,
    media,
    playheadMs,
    setPlayheadMs,
    addMediaToTimeline,
    updateSequence,
    updateSequenceNoHistory,
    addMedia,
    undo,
    redo,
    canUndo,
    canRedo,
  };

  return (
    <TimelineContext.Provider value={value}>
      {children}
    </TimelineContext.Provider>
  );
};
