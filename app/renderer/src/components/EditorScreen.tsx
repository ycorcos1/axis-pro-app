/**
 * Editor Screen Component with Timeline Context
 * @mem ref: pr15-undo-redo
 * Wraps the editor UI with TimelineProvider for undo/redo support
 */

import React, { useEffect, useCallback } from "react";
import { TimelineProvider, useTimeline } from "../contexts/TimelineContext";
import TopBar, { RecordingMode } from "./TopBar";
import MediaLibrary from "./MediaLibrary";
import PreviewPanel from "./PreviewPanel";
import ProTimeline from "./ProTimeline";
import PropertiesPanel from "./PropertiesPanel";
import RecordingPanel from "./RecordingPanel";
import type {
  Sequence,
  MediaInfo as TimelineMediaInfo,
} from "../../../shared/timelineTypes";

// Import Clip type (legacy format)
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
  isMissing?: boolean;
}

interface EditorScreenInnerProps {
  clips: Clip[];
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
  onImportClips: (filePaths: string[]) => Promise<void>;
  onRelinkMedia: (clipId: string) => Promise<void>;
  onUpdateClipThumbnail: (clipId: string, thumbnailUrl: string) => void;
  onRemoveClip: (clipId: string) => Promise<void>;
  onRenameClip: (clipId: string, newFilename: string) => Promise<void>;
  onUpdateTrim: (clipId: string, inMs: number, outMs: number) => void;
  onTimelineExport: () => Promise<void>;
  onExport: () => Promise<void>;
  isExporting: boolean;
  projectId: string | null;
  projectTitle: string;
  projectThumbnailUrl: string | null;
  onUpdateProjectTitle: (projectId: string, newTitle: string) => Promise<void>;
  onUpdateProjectThumbnail: (projectId: string) => Promise<void>;
  onClearProjectThumbnail: (projectId: string) => Promise<void>;
  onBackToDashboard: () => void;
  onNewProject: () => Promise<void>;
  onSelectFiles: () => Promise<void>;
  onSaveProject: (manual?: boolean) => Promise<void>;
  isSaving: boolean;
  lastSaved: number | null;
  onRecordingModeSelect: (mode: RecordingMode) => void;
  showRecordingPanel: boolean;
  recordingMode: RecordingMode | null;
  onCloseRecordingPanel: () => void;
  onRecordingComplete: (filePath: string) => Promise<void>;
}

const EditorScreenInner: React.FC<EditorScreenInnerProps> = ({
  clips,
  selectedClipId,
  onSelectClip,
  onImportClips,
  onRelinkMedia,
  onUpdateClipThumbnail,
  onRemoveClip,
  onRenameClip,
  onUpdateTrim,
  onTimelineExport,
  onExport,
  isExporting,
  projectId,
  projectTitle,
  projectThumbnailUrl,
  onUpdateProjectTitle,
  onUpdateProjectThumbnail,
  onClearProjectThumbnail,
  onBackToDashboard,
  onNewProject,
  onSelectFiles,
  onSaveProject,
  isSaving,
  lastSaved,
  onRecordingModeSelect,
  showRecordingPanel,
  recordingMode,
  onCloseRecordingPanel,
  onRecordingComplete,
}) => {
  const {
    sequence,
    media,
    playheadMs,
    setPlayheadMs,
    updateSequence,
    addMedia,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useTimeline();

  // Overlay selection state
  const [selectedOverlayId, setSelectedOverlayId] = React.useState<
    string | null
  >(null);

  const selectedClip = clips.find((clip) => clip.id === selectedClipId) || null;

  // Get selected overlay from sequence
  const selectedOverlay = React.useMemo(() => {
    if (!selectedOverlayId || !sequence?.overlays) return null;
    return sequence.overlays.find((o) => o.id === selectedOverlayId) || null;
  }, [selectedOverlayId, sequence?.overlays]);

  // Handler for selecting overlays
  const handleSelectOverlay = useCallback(
    (overlayId: string | null) => {
      setSelectedOverlayId(overlayId);
      // Deselect clip when overlay is selected
      if (overlayId) {
        onSelectClip(null);
      }
    },
    [onSelectClip]
  );

  // Handler for updating overlays
  const handleUpdateOverlay = useCallback(
    (overlayId: string, updates: Partial<any>) => {
      const result = require("../../../shared/timelineReducers").updateOverlay(
        sequence,
        overlayId,
        updates
      );
      if ("sequence" in result && result.sequence) {
        updateSequence(result.sequence);
      }
    },
    [sequence, updateSequence]
  );

  // Handler for deleting overlays
  const handleDeleteOverlay = useCallback(
    (overlayId: string) => {
      const result = require("../../../shared/timelineReducers").deleteOverlay(
        sequence,
        overlayId
      );
      if ("sequence" in result && result.sequence) {
        updateSequence(result.sequence);
        setSelectedOverlayId(null);
      }
    },
    [sequence, updateSequence]
  );

  // Keyboard shortcuts including undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = window.electronAPI.platform === "darwin";
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Undo: ⌘Z or Ctrl+Z
      if (modKey && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          undo();
          console.log("[EditorScreen] Undo executed");
        }
      }
      // Redo: ⌘⇧Z or Ctrl+Shift+Z
      else if (modKey && e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        if (canRedo) {
          redo();
          console.log("[EditorScreen] Redo executed");
        }
      }
      // Import: ⌘I or Ctrl+I
      else if (modKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        onSelectFiles();
      }
      // Save: ⌘S or Ctrl+S
      else if (modKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (projectId && !isSaving) {
          onSaveProject(true);
        }
      }
      // Export: ⌘E or Ctrl+E
      else if (modKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        if (selectedClip && !isExporting) {
          onExport();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    canUndo,
    canRedo,
    undo,
    redo,
    selectedClip,
    isExporting,
    isSaving,
    projectId,
    onSelectFiles,
    onSaveProject,
    onExport,
  ]);

  return (
    <div className="app-container">
      <div className="app-topbar">
        <TopBar
          onImportClick={onSelectFiles}
          onExportClick={onExport}
          isExporting={isExporting}
          exportDisabled={!selectedClip}
          onBackToDashboard={onBackToDashboard}
          projectId={projectId}
          onSaveClick={() => onSaveProject(true)}
          isSaving={isSaving}
          lastSaved={lastSaved}
          onNewProject={onNewProject}
          onOpenProject={onBackToDashboard}
          onRecordingModeSelect={onRecordingModeSelect}
        />
      </div>

      <div className="app-main-content">
        <div className="app-media-library">
          <MediaLibrary
            clips={clips}
            selectedClipId={selectedClipId}
            onSelectClip={onSelectClip}
            onImportClips={onImportClips}
            onRelinkMedia={onRelinkMedia}
            onUpdateClipThumbnail={onUpdateClipThumbnail}
            onRemoveClip={onRemoveClip}
            onRenameClip={onRenameClip}
          />
        </div>

        <div className="app-preview">
          <PreviewPanel
            clip={selectedClip}
            onCurrentTimeChange={() => {}}
            onSeekTo={setPlayheadMs}
            sequence={sequence}
            media={media}
            playheadMs={playheadMs}
            onPlayheadChange={setPlayheadMs}
          />
        </div>

        <div className="app-properties">
          <PropertiesPanel
            clip={selectedClip}
            onUpdateTrim={onUpdateTrim}
            onExport={onTimelineExport}
            isExporting={isExporting}
            projectId={projectId}
            projectTitle={projectTitle}
            projectThumbnailUrl={projectThumbnailUrl}
            onUpdateProjectTitle={onUpdateProjectTitle}
            onUpdateProjectThumbnail={onUpdateProjectThumbnail}
            onClearProjectThumbnail={onClearProjectThumbnail}
            selectedOverlay={selectedOverlay}
            onUpdateOverlay={handleUpdateOverlay}
            onDeleteOverlay={handleDeleteOverlay}
          />
        </div>
      </div>

      <div className="app-timeline">
        <ProTimeline
          sequence={sequence}
          media={media}
          playheadMs={playheadMs}
          onSequenceChange={updateSequence}
          onSeek={setPlayheadMs}
          onMediaAdd={(mediaId, mediaInfo) => {
            addMedia(mediaInfo);
          }}
          selectedOverlayId={selectedOverlayId}
          onSelectOverlay={handleSelectOverlay}
        />
      </div>

      {/* Recording Panel Modal */}
      {showRecordingPanel && (
        <div
          className="recording-modal-overlay"
          onClick={onCloseRecordingPanel}
        >
          <div
            className="recording-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <RecordingPanel
              projectId={projectId}
              onRecordingComplete={onRecordingComplete}
              mode={recordingMode}
              onClose={onCloseRecordingPanel}
            />
          </div>
        </div>
      )}

      {/* Export Progress Indicator */}
      {isExporting && (
        <div className="export-indicator">
          <div className="export-indicator-spinner"></div>
          <span>Exporting...</span>
        </div>
      )}

      {/* Undo/Redo Status Indicator (optional debug) */}
      {(canUndo || canRedo) && (
        <div
          style={{
            position: "fixed",
            bottom: "10px",
            right: "10px",
            background: "rgba(0, 0, 0, 0.7)",
            color: "white",
            padding: "8px 12px",
            borderRadius: "4px",
            fontSize: "12px",
            pointerEvents: "none",
            zIndex: 9999,
          }}
        >
          {canUndo && "⌘Z: Undo"}
          {canUndo && canRedo && " | "}
          {canRedo && "⌘⇧Z: Redo"}
        </div>
      )}
    </div>
  );
};

interface EditorScreenProps
  extends Omit<EditorScreenInnerProps, "sequence" | "media" | "playheadMs"> {
  timelineSequence: Sequence;
  timelineMedia: Record<string, TimelineMediaInfo>;
  playheadMs: number;
  onSequenceChange: (sequence: Sequence) => void;
  onMediaChange: (media: Record<string, TimelineMediaInfo>) => void;
  onPlayheadChange: (ms: number) => void;
}

const EditorScreen: React.FC<EditorScreenProps> = ({
  timelineSequence,
  timelineMedia,
  playheadMs: externalPlayheadMs,
  onSequenceChange,
  onMediaChange,
  onPlayheadChange,
  ...props
}) => {
  return (
    <TimelineProvider
      initialSequence={timelineSequence}
      initialMedia={timelineMedia}
      onSequenceChange={onSequenceChange}
      onMediaChange={onMediaChange}
    >
      <EditorScreenInner {...props} />
    </TimelineProvider>
  );
};

export default EditorScreen;
