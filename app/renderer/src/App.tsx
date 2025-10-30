/**
 * Main React application component
 * @mem ref: arch-fwk, design-spec, pr5-import, pr6-timeline, pr7-preview-player, pr8-export, pr9-dashboard, pr14-timeline, pr16-text-overlays
 * Main UI layout per Axis Pro Design Specification
 * Manages global app state including imported clips and timeline state
 * Routes between Dashboard and Editing Screen
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import Dashboard from "./components/Dashboard";
import TopBar, { RecordingMode } from "./components/TopBar";
import MediaLibrary from "./components/MediaLibrary";
import PreviewPanel from "./components/PreviewPanel";
import ProTimeline from "./components/ProTimeline";
import PropertiesPanel from "./components/PropertiesPanel";
import RecordingPanel from "./components/RecordingPanel";
import Toast, { Toast as ToastType } from "./components/Toast";
import { TimelineProvider, useTimeline } from "./contexts/TimelineContext";
import { createDefaultSequence } from "../../shared/timelineReducers";
import * as timelineReducers from "../../shared/timelineReducers";
import type {
  Sequence,
  MediaInfo as TimelineMediaInfo,
  Overlay,
} from "../../shared/timelineTypes";
import "./styles/theme.css";
import "./styles/layout.css";

// Import Clip type from shared types (legacy format for backward compatibility)
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

type AppView = "dashboard" | "editor";

const App: React.FC = () => {
  // View routing
  const [currentView, setCurrentView] = useState<AppView>("dashboard");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>("Untitled Project");
  const [projectThumbnailUrl, setProjectThumbnailUrl] = useState<string | null>(
    null
  );

  // Global state for imported clips
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0); // Current playback time in ms

  // Pro Timeline state (PR #14)
  const [timelineSequence, setTimelineSequence] = useState<Sequence>(() =>
    createDefaultSequence()
  );
  const [timelineMedia, setTimelineMedia] = useState<
    Record<string, TimelineMediaInfo>
  >({});
  const [playheadMs, setPlayheadMs] = useState<number>(0);

  // Overlay state (PR #16)
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
    null
  );

  // Timeline resize state
  const [timelineHeight, setTimelineHeight] = useState(250); // Default height
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);

  // Reset currentTime when clip changes
  useEffect(() => {
    setCurrentTime(0);
  }, [selectedClipId]);

  // Auto-save when timeline sequence changes (PR #14)
  useEffect(() => {
    if (
      currentProjectId &&
      timelineSequence?.tracks &&
      Array.isArray(timelineSequence.tracks) &&
      timelineSequence.tracks.some((t) => t.clips.length > 0)
    ) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        console.log("[App] Auto-saving timeline changes");
        handleSaveProject();
      }, 2000); // Save 2 seconds after last timeline change
    }
  }, [timelineSequence, currentProjectId]);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [isManualSave, setIsManualSave] = useState(false);

  // Debounce ref for auto-save
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastType[]>([]);

  // Recording panel visibility and mode
  const [showRecordingPanel, setShowRecordingPanel] = useState(false);
  const [recordingMode, setRecordingMode] = useState<
    "movie" | "audio" | "screen" | "screen-camera" | null
  >(null);

  /**
   * Show a toast notification
   * Limits to max 3 toasts visible at once
   */
  const showToast = (message: string, type: ToastType["type"] = "info") => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => {
      // Keep only the last 2 toasts and add the new one (max 3 visible)
      const recentToasts = prev.slice(-2);
      return [...recentToasts, { id, message, type }];
    });
  };

  /**
   * Dismiss a toast notification
   */
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  /**
   * Save the current project state
   * @param manual - Whether this is a manual save (from user clicking Save button)
   * @param clipsToSave - Optional clips array to save (for immediate saves after state changes)
   */
  const handleSaveProject = async (
    manual: boolean = false,
    clipsToSave?: Clip[]
  ) => {
    if (!currentProjectId) {
      console.warn("[App] No project to save");
      return;
    }

    // Use provided clips or current state
    const clipsForSave = clipsToSave || clips;

    try {
      setIsSaving(true);
      setIsManualSave(manual);
      console.log("[App] Saving project:", currentProjectId);
      console.log("[App] Saving with", clipsForSave.length, "clips");
      const project = await window.electronAPI.loadProject(currentProjectId);
      if (!project) {
        console.error("[App] Cannot save: project not found");
        return;
      }

      // Convert clips from editing format to project format (legacy)
      const projectClips: Record<string, any> = {};
      clipsForSave.forEach((clip) => {
        projectClips[clip.id] = {
          id: clip.id,
          path: clip.path,
          filename: clip.filename,
          durationMs: clip.duration,
          width: clip.width,
          height: clip.height,
        };
      });

      // Create segments from clips (currently just one clip with trim points)
      const segments = clipsForSave
        .filter((clip) => clip.inMs !== 0 || clip.outMs !== clip.duration)
        .map((clip) => ({
          id: `seg-${clip.id}`,
          clipId: clip.id,
          inMs: clip.inMs,
          outMs: clip.outMs,
          startMs: 0,
        }));

      // Update project with current state (legacy + new timeline format)
      project.clips = projectClips;
      project.segments = segments;

      // Save new timeline format (PR #14)
      project.sequence = timelineSequence;
      project.media = timelineMedia;

      // Save the project
      await window.electronAPI.saveProject(project);
      console.log(
        "[App] Project saved with",
        Object.keys(projectClips).length,
        "clips"
      );

      // Generate thumbnail if we have clips and no thumbnail yet
      if (clipsForSave.length > 0 && !project.previewThumbPath) {
        try {
          await window.electronAPI.generateProjectThumbnail(
            currentProjectId,
            clipsForSave[0].path
          );
        } catch (error) {
          console.error("[App] Failed to generate thumbnail:", error);
        }
      }

      if (manual) {
        setLastSaved(Date.now());
        console.log("[App] Project saved successfully (manual)");
        showToast("Project saved", "success");
      } else {
        console.log("[App] Project saved successfully (auto)");
      }
    } catch (error) {
      console.error("[App] Failed to save project:", error);
      showToast("Failed to save project", "error");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Load project clips and segments into editing state
   */
  const loadProjectState = async (project: any) => {
    try {
      console.log("[App] Loading project state:", project.id);

      const loadedClips: Clip[] = [];

      // Convert project clips back to editing format
      if (project.clips) {
        for (const [clipId, projectClip] of Object.entries(project.clips)) {
          const clip = projectClip as any;

          loadedClips.push({
            id: clip.id,
            path: clip.path,
            filename:
              clip.filename || clip.path.split(/[/\\]/).pop() || "Unknown",
            duration: clip.durationMs,
            width: clip.width,
            height: clip.height,
            inMs: 0,
            outMs: clip.durationMs,
            thumbnailUrl: undefined, // Will be generated if needed
          });
        }

        // Apply segment trim points if any
        if (project.segments && project.segments.length > 0) {
          for (const segment of project.segments) {
            const clip = loadedClips.find((c) => c.id === segment.clipId);
            if (clip) {
              clip.inMs = segment.inMs;
              clip.outMs = segment.outMs;
            }
          }
        }
      }

      // Load new timeline format (PR #14)
      if (project.sequence) {
        setTimelineSequence(project.sequence);
      } else {
        setTimelineSequence(createDefaultSequence());
      }

      if (project.media) {
        setTimelineMedia(project.media);

        // Also add media to legacy clips for Media Library display
        for (const [mediaId, mediaInfo] of Object.entries(project.media)) {
          const media = mediaInfo as TimelineMediaInfo;
          if (!loadedClips.find((c) => c.path === media.path)) {
            loadedClips.push({
              id: mediaId,
              path: media.path,
              filename: media.path.split(/[/\\]/).pop() || "Unknown",
              duration: media.durationMs,
              width: media.streams?.v?.w || 1920,
              height: media.streams?.v?.h || 1080,
              inMs: 0,
              outMs: media.durationMs,
              thumbnailUrl: undefined,
            });
          }
        }
      } else {
        setTimelineMedia({});
      }

      setClips(loadedClips);
      setProjectTitle(project.title || "Untitled Project");

      // Load project thumbnail if available
      if (project.previewThumbPath) {
        setProjectThumbnailUrl(`local-image://${project.previewThumbPath}`);
      } else {
        setProjectThumbnailUrl(null);
      }

      console.log("[App] Project state loaded:", loadedClips.length, "clips");
      console.log(
        "[App] Timeline sequence loaded:",
        project.sequence ? "yes" : "no"
      );
      console.log(
        "[App] Timeline media loaded:",
        project.media ? Object.keys(project.media).length : 0
      );
    } catch (error) {
      console.error("[App] Failed to load project state:", error);
    }
  };

  /**
   * Handle opening a project from dashboard
   */
  const handleOpenProject = async (projectId: string) => {
    try {
      console.log("[App] Opening project:", projectId);
      const project = await window.electronAPI.loadProject(projectId);

      if (project) {
        setCurrentProjectId(projectId);
        await loadProjectState(project);
        setCurrentView("editor");
      } else {
        console.error("[App] Project not found:", projectId);
      }
    } catch (error) {
      console.error("[App] Failed to open project:", error);
    }
  };

  /**
   * Handle creating a new project
   */
  const handleNewProject = async () => {
    try {
      console.log("[App] Creating new project");
      const project = await window.electronAPI.createProject(
        "Untitled Project"
      );
      setCurrentProjectId(project.id);
      setClips([]);
      setSelectedClipId(null);
      setTimelineSequence(createDefaultSequence());
      setTimelineMedia({});
      setPlayheadMs(0);
      setCurrentView("editor");
    } catch (error) {
      console.error("[App] Failed to create project:", error);
    }
  };

  /**
   * Handle returning to dashboard
   */
  const handleBackToDashboard = () => {
    setCurrentView("dashboard");
    setCurrentProjectId(null);
    setClips([]);
    setSelectedClipId(null);
  };

  /**
   * Handle recording completion
   * Auto-import the recorded file to the timeline
   */
  const handleRecordingComplete = async (filePath: string) => {
    try {
      console.log("[App] Recording complete:", filePath);

      // Import the recorded file
      await handleImportClips([filePath]);

      // Show single success toast after import completes
      showToast("Recording saved and imported successfully!", "success");

      // Hide recording panel after successful completion
      setShowRecordingPanel(false);
      setRecordingMode(null);
    } catch (error) {
      console.error("[App] Failed to import recording:", error);
      showToast("Failed to import recording", "error");
    }
  };

  /**
   * Handle menu commands from native menu
   */
  useEffect(() => {
    // @ts-ignore - Electron IPC renderer
    const { ipcRenderer } = window.require
      ? window.require("electron")
      : { ipcRenderer: null };

    if (!ipcRenderer) return;

    // Menu: New Project
    const handleMenuNewProject = () => {
      handleNewProject();
    };

    // Menu: Open Project
    const handleMenuOpenProject = () => {
      handleBackToDashboard();
    };

    // Menu: Import Media
    const handleMenuImportMedia = () => {
      handleSelectFiles();
    };

    // Menu: New Movie Recording (webcam only)
    const handleMenuRecordMovie = () => {
      if (!currentProjectId) {
        showToast("Please create or open a project first", "warning");
        return;
      }
      setRecordingMode("movie");
      setShowRecordingPanel(true);
    };

    // Menu: New Audio Recording
    const handleMenuRecordAudio = () => {
      if (!currentProjectId) {
        showToast("Please create or open a project first", "warning");
        return;
      }
      setRecordingMode("audio");
      setShowRecordingPanel(true);
    };

    // Menu: New Screen Recording
    const handleMenuRecordScreen = () => {
      if (!currentProjectId) {
        showToast("Please create or open a project first", "warning");
        return;
      }
      setRecordingMode("screen");
      setShowRecordingPanel(true);
    };

    // Menu: New Screen Recording with Camera (PiP)
    const handleMenuRecordScreenCamera = () => {
      if (!currentProjectId) {
        showToast("Please create or open a project first", "warning");
        return;
      }
      setRecordingMode("screen-camera");
      setShowRecordingPanel(true);
    };

    // Menu: Export
    const handleMenuExport = () => {
      const currentSelectedClip = clips.find((c) => c.id === selectedClipId);
      if (currentSelectedClip) {
        handleExport();
      } else {
        showToast("Please select a clip to export", "warning");
      }
    };

    // Register listeners
    window.electronAPI.onMenuEvent("menu-new-project", handleMenuNewProject);
    window.electronAPI.onMenuEvent("menu-open-project", handleMenuOpenProject);
    window.electronAPI.onMenuEvent("menu-import-media", handleMenuImportMedia);
    window.electronAPI.onMenuEvent("menu-record-movie", handleMenuRecordMovie);
    window.electronAPI.onMenuEvent("menu-record-audio", handleMenuRecordAudio);
    window.electronAPI.onMenuEvent(
      "menu-record-screen",
      handleMenuRecordScreen
    );
    window.electronAPI.onMenuEvent(
      "menu-record-screen-camera",
      handleMenuRecordScreenCamera
    );
    window.electronAPI.onMenuEvent("menu-export", handleMenuExport);

    // Cleanup
    return () => {
      window.electronAPI.removeMenuListener(
        "menu-new-project",
        handleMenuNewProject
      );
      window.electronAPI.removeMenuListener(
        "menu-open-project",
        handleMenuOpenProject
      );
      window.electronAPI.removeMenuListener(
        "menu-import-media",
        handleMenuImportMedia
      );
      window.electronAPI.removeMenuListener(
        "menu-record-movie",
        handleMenuRecordMovie
      );
      window.electronAPI.removeMenuListener(
        "menu-record-audio",
        handleMenuRecordAudio
      );
      window.electronAPI.removeMenuListener(
        "menu-record-screen",
        handleMenuRecordScreen
      );
      window.electronAPI.removeMenuListener(
        "menu-record-screen-camera",
        handleMenuRecordScreenCamera
      );
      window.electronAPI.removeMenuListener("menu-export", handleMenuExport);
    };
  }, [currentProjectId, selectedClipId, clips]);

  /**
   * Handle importing clips from file paths
   * Calls IPC to probe files and create Clip objects
   */
  const handleImportClips = async (filePaths: string[]) => {
    try {
      console.log("[App] Importing clips:", filePaths);
      console.log("[App] Current clips before import:", clips);
      const importedClips = await window.electronAPI.importClips(filePaths);
      console.log("[App] Imported clips received:", importedClips);

      // Update clips state and get the new array for saving
      const newClips = [...clips, ...importedClips];
      setClips(newClips);
      console.log("[App] New clips state:", newClips);
      console.log("[App] Import successful:", importedClips.length, "clips");

      // Also probe media for timeline format and add to timelineMedia
      for (const clip of importedClips) {
        try {
          const mediaInfo = await window.electronAPI.media.probe(clip.path);
          setTimelineMedia((prev) => ({
            ...prev,
            [mediaInfo.id]: mediaInfo,
          }));
          console.log("[App] Added media to timeline:", mediaInfo.id);
        } catch (error) {
          console.error("[App] Failed to probe media:", clip.path, error);
        }
      }

      // Auto-save after import with the updated clips array
      if (currentProjectId) {
        await handleSaveProject(false, newClips);
      }
    } catch (error) {
      console.error("[App] Import failed:", error);
      // TODO: Show error notification to user
    }
  };

  /**
   * Handle adding media to timeline from Media Library (PR #14)
   */
  const handleAddMediaToTimeline = async (clipId: string) => {
    try {
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) {
        console.error("[App] Clip not found:", clipId);
        return;
      }

      console.log("[App] Adding media to timeline:", clip.path);

      // Probe media to get timeline format
      const mediaInfo = await window.electronAPI.media.probe(clip.path);

      // Add to timeline media if not already present
      if (!timelineMedia[mediaInfo.id]) {
        setTimelineMedia((prev) => ({
          ...prev,
          [mediaInfo.id]: mediaInfo,
        }));
      }

      showToast(`Added ${clip.filename} to Media Library`, "success");

      // Auto-save after adding media
      if (currentProjectId) {
        await handleSaveProject(false);
      }
    } catch (error) {
      console.error("[App] Failed to add media to timeline:", error);
      showToast("Failed to add media to timeline", "error");
    }
  };

  /**
   * Handle file selection via picker dialog
   */
  const handleSelectFiles = async () => {
    try {
      const filePaths = await window.electronAPI.selectFiles();
      if (filePaths.length > 0) {
        await handleImportClips(filePaths);
      }
    } catch (error) {
      console.error("[App] File selection failed:", error);
    }
  };

  /**
   * Handle relinking a missing media file
   */
  const handleRelinkMedia = async (clipId: string) => {
    try {
      // Open file picker
      const filePaths = await window.electronAPI.selectFiles();
      if (filePaths.length === 0) return;

      const newPath = filePaths[0];

      // Probe the new file to get its metadata
      const newClip = await window.electronAPI.importClips([newPath]);
      if (newClip.length === 0) return;

      // Update the clip's path
      setClips((prevClips) =>
        prevClips.map((clip) =>
          clip.id === clipId
            ? {
                ...clip,
                path: newPath,
                filename: newClip[0].filename,
                duration: newClip[0].duration,
                width: newClip[0].width,
                height: newClip[0].height,
                isMissing: false,
              }
            : clip
        )
      );

      // Auto-save after relinking
      if (currentProjectId) {
        await handleSaveProject();
      }
    } catch (error) {
      console.error("[App] Failed to relink media:", error);
    }
  };

  /**
   * Handle thumbnail update
   * Updates the thumbnailUrl for a specific clip
   */
  const handleUpdateClipThumbnail = useCallback(
    (clipId: string, thumbnailUrl: string) => {
      setClips((prevClips) =>
        prevClips.map((clip) =>
          clip.id === clipId ? { ...clip, thumbnailUrl } : clip
        )
      );
    },
    []
  );

  /**
   * Handle removing a clip from the project
   */
  const handleRemoveClip = async (clipId: string) => {
    const clipToRemove = clips.find((clip) => clip.id === clipId);
    const updatedClips = clips.filter((clip) => clip.id !== clipId);

    // Calculate updated timeline media and sequence
    let updatedTimelineMedia = timelineMedia;
    let updatedSequence = timelineSequence;

    if (clipToRemove) {
      // Find and remove media entry with matching path
      updatedTimelineMedia = { ...timelineMedia };
      for (const [mediaId, mediaInfo] of Object.entries(timelineMedia)) {
        if (mediaInfo.path === clipToRemove.path) {
          delete updatedTimelineMedia[mediaId];
          console.log("[App] Removed media from timeline:", mediaId);
        }
      }

      // Also remove any clips from the timeline sequence that use this media
      updatedSequence = {
        ...timelineSequence,
        tracks: timelineSequence.tracks.map((track) => ({
          ...track,
          clips: track.clips.filter((clip) => {
            const media = timelineMedia[clip.mediaId];
            return media && media.path !== clipToRemove.path;
          }),
        })),
      };
    }

    // Update all state
    setClips(updatedClips);
    setTimelineMedia(updatedTimelineMedia);
    setTimelineSequence(updatedSequence);

    // If the removed clip was selected, clear selection
    if (selectedClipId === clipId) {
      setSelectedClipId(null);
    }

    showToast("Clip removed from project", "info");

    // Auto-save after removal with updated state
    if (currentProjectId) {
      // Wait a tick for state to settle, then save with the calculated values
      setTimeout(async () => {
        try {
          const project = await window.electronAPI.loadProject(
            currentProjectId
          );
          if (!project) {
            console.error("[App] Cannot save: project not found");
            return;
          }

          // Convert clips from editing format to project format
          const projectClips: Record<string, any> = {};
          updatedClips.forEach((clip) => {
            projectClips[clip.id] = {
              id: clip.id,
              path: clip.path,
              filename: clip.filename,
              durationMs: clip.duration,
              width: clip.width,
              height: clip.height,
            };
          });

          // Create segments from clips
          const segments = updatedClips
            .filter((clip) => clip.inMs !== 0 || clip.outMs !== clip.duration)
            .map((clip) => ({
              id: `seg-${clip.id}`,
              clipId: clip.id,
              inMs: clip.inMs,
              outMs: clip.outMs,
              startMs: 0,
            }));

          // Update project with current state
          project.clips = projectClips;
          project.segments = segments;
          project.sequence = updatedSequence;
          project.media = updatedTimelineMedia;

          // Save the project
          await window.electronAPI.saveProject(project);
          console.log(
            "[App] Project auto-saved after clip removal with",
            Object.keys(projectClips).length,
            "clips"
          );

          // If there are remaining clips, regenerate thumbnail from the first one
          if (updatedClips.length > 0) {
            try {
              await window.electronAPI.generateProjectThumbnail(
                currentProjectId,
                updatedClips[0].path
              );
              console.log(
                "[App] Project thumbnail regenerated from remaining clip"
              );
            } catch (error) {
              console.error(
                "[App] Failed to regenerate project thumbnail:",
                error
              );
            }
          }
        } catch (error) {
          console.error("[App] Failed to auto-save after clip removal:", error);
          showToast("Failed to save project", "error");
        }
      }, 100);
    }
  };

  /**
   * Handle renaming a clip
   * Note: This only updates the display name, not the actual file path
   */
  const handleRenameClip = async (clipId: string, newFilename: string) => {
    const updatedClips = clips.map((clip) => {
      if (clip.id === clipId) {
        return { ...clip, filename: newFilename };
      }
      return clip;
    });

    setClips(updatedClips);
    showToast("Clip renamed", "success");

    // Auto-save after rename
    if (currentProjectId) {
      await handleSaveProject(false, updatedClips);
    }
  };

  /**
   * Handle project title update
   */
  const handleUpdateProjectTitle = async (
    projectId: string,
    newTitle: string
  ) => {
    try {
      await window.electronAPI.renameProject(projectId, newTitle);
      setProjectTitle(newTitle);
      showToast("Project renamed", "success");
    } catch (error) {
      console.error("[App] Failed to rename project:", error);
      showToast("Failed to rename project", "error");
    }
  };

  /**
   * Handle updating project thumbnail from first clip
   */
  const handleUpdateProjectThumbnail = async (projectId: string) => {
    try {
      // Let user select an image file
      const filePaths = await window.electronAPI.showOpenDialog({
        properties: ["openFile"],
        filters: [
          { name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp"] },
        ],
      });

      if (!filePaths || filePaths.length === 0) {
        return; // User cancelled
      }

      const selectedImagePath = filePaths[0];

      // Generate thumbnail by copying the selected image
      const thumbnailPath =
        await window.electronAPI.setProjectThumbnailFromFile(
          projectId,
          selectedImagePath
        );

      if (thumbnailPath) {
        setProjectThumbnailUrl(`local-image://${thumbnailPath}`);
        showToast("Thumbnail updated", "success");
      } else {
        showToast("Failed to set thumbnail", "error");
      }
    } catch (error) {
      console.error("[App] Failed to update project thumbnail:", error);
      showToast("Failed to update thumbnail", "error");
    }
  };

  /**
   * Handle clearing project thumbnail
   */
  const handleClearProjectThumbnail = async (projectId: string) => {
    try {
      const project = await window.electronAPI.loadProject(projectId);
      if (project) {
        project.previewThumbPath = undefined;
        await window.electronAPI.saveProject(project);
        setProjectThumbnailUrl(null);
        showToast("Thumbnail cleared", "success");
      }
    } catch (error) {
      console.error("[App] Failed to clear project thumbnail:", error);
      showToast("Failed to clear thumbnail", "error");
    }
  };

  /**
   * Handle trim updates from Timeline
   * Updates the inMs/outMs for a specific clip
   */
  const handleUpdateTrim = (clipId: string, inMs: number, outMs: number) => {
    setClips((prevClips) =>
      prevClips.map((clip) =>
        clip.id === clipId ? { ...clip, inMs, outMs } : clip
      )
    );

    // Debounced auto-save
    if (currentProjectId) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        handleSaveProject();
      }, 2000); // Save 2 seconds after last trim change
    }
  };

  /**
   * Handle overlay updates (PR #16)
   */
  const handleUpdateOverlay = (
    overlayId: string,
    updates: Partial<Overlay>
  ) => {
    const result = timelineReducers.updateOverlay(
      timelineSequence,
      overlayId,
      updates
    );
    if ("sequence" in result) {
      setTimelineSequence(result.sequence);
    }
  };

  /**
   * Handle overlay deletion (PR #16)
   */
  const handleDeleteOverlay = (overlayId: string) => {
    const result = timelineReducers.deleteOverlay(timelineSequence, overlayId);
    if ("sequence" in result) {
      setTimelineSequence(result.sequence);
      setSelectedOverlayId(null);
      showToast("Overlay deleted", "info");
    }
  };

  /**
   * Get selected overlay
   */
  const selectedOverlay =
    selectedOverlayId && timelineSequence?.overlays
      ? timelineSequence.overlays.find((o) => o.id === selectedOverlayId) ||
        null
      : null;

  /**
   * Handle timeline resize
   */
  const handleTimelineResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingTimeline(true);
  };

  useEffect(() => {
    if (!isResizingTimeline) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate new height based on mouse Y position
      const viewportHeight = window.innerHeight;
      const topBarHeight = 48; // Approximate topbar height
      const newHeight = viewportHeight - e.clientY;

      // Clamp between min and max
      const clampedHeight = Math.max(150, Math.min(600, newHeight));
      setTimelineHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      setIsResizingTimeline(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingTimeline]);

  // Handle timeline click to seek
  const handleSeekTo = (timeMs: number) => {
    // Use the exposed seek function from PreviewPanel
    if ((window as any).__previewSeek) {
      (window as any).__previewSeek(timeMs);
    }
  };

  /**
   * Handle export of timeline sequence
   * Opens save dialog and calls FFmpeg to export multi-track composition
   */
  const handleTimelineExport = async () => {
    if (!timelineSequence || !timelineMedia) {
      console.warn("[App] No timeline to export");
      showToast("Timeline is empty", "warning");
      return;
    }

    // Check if timeline has any clips
    const hasClips = timelineSequence.tracks?.some((t) => t.clips.length > 0);
    if (!hasClips) {
      console.warn("[App] Timeline has no clips");
      showToast("Add clips to timeline before exporting", "warning");
      return;
    }

    try {
      setIsExporting(true);

      // Generate default filename based on project
      const timestamp = new Date().toISOString().split("T")[0];
      const defaultFilename = projectTitle
        ? `${projectTitle}-${timestamp}.mp4`
        : `axis-pro-export-${timestamp}.mp4`;

      // Show save dialog
      const savePath = await window.electronAPI.selectSavePath(defaultFilename);

      if (!savePath) {
        // User canceled
        setIsExporting(false);
        return;
      }

      console.log("[App] Exporting timeline to:", savePath);
      // Toast removed - using modal instead

      // Call timeline export API
      const result = await window.electronAPI.timeline.exportSequence(
        timelineSequence,
        timelineMedia,
        savePath
      );

      if (result.success) {
        console.log("[App] Timeline export successful:", result.outputPath);
        showToast("Export completed successfully!", "success");
      } else {
        console.error("[App] Timeline export failed:", result.error);
        showToast(`Export failed: ${result.error || "Unknown error"}`, "error");
      }
    } catch (error) {
      console.error("[App] Timeline export error:", error);
      showToast(
        `Export error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "error"
      );
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Handle export of selected clip
   * Opens save dialog and calls FFmpeg to export trimmed video
   */
  const handleExport = async () => {
    if (!selectedClip) {
      console.warn("[App] No clip selected for export");
      showToast("Please select a clip to export", "warning");
      return;
    }

    try {
      setIsExporting(true);

      // Generate default filename: originalname-trimmed.mp4
      const baseName = selectedClip.filename.replace(/\.[^/.]+$/, "");
      const defaultFilename = `${baseName}-trimmed.mp4`;

      // Show save dialog
      const savePath = await window.electronAPI.selectSavePath(defaultFilename);

      if (!savePath) {
        // User canceled
        setIsExporting(false);
        return;
      }

      console.log("[App] Exporting to:", savePath);
      showToast("Exporting video...", "info");

      // Call export API
      const segment = {
        clipPath: selectedClip.path,
        inMs: selectedClip.inMs,
        outMs: selectedClip.outMs,
      };

      const result = await window.electronAPI.exportTimeline(segment, savePath);

      if (result.success) {
        console.log("[App] Export successful:", result.outputPath);
        showToast("Export completed successfully!", "success");
      } else {
        console.error("[App] Export failed:", result.error);
        showToast(`Export failed: ${result.error || "Unknown error"}`, "error");
      }
    } catch (error) {
      console.error("[App] Export error:", error);
      showToast(
        `Export error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "error"
      );
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Handle recording mode selection from TopBar menu
   */
  const handleRecordingModeSelect = (mode: RecordingMode) => {
    setRecordingMode(mode);
    setShowRecordingPanel(true);
  };

  /**
   * Handle closing the recording panel
   */
  const handleCloseRecordingPanel = () => {
    setShowRecordingPanel(false);
    setRecordingMode(null);
  };

  // Get the currently selected clip object
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) || null;

  /**
   * Keyboard shortcuts
   * ⌘/Ctrl+I = Import
   * ⌘/Ctrl+E = Export
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts in editor view
      if (currentView !== "editor") return;

      const isMac = window.electronAPI.platform === "darwin";
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        handleSelectFiles();
      } else if (modKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (currentProjectId && !isSaving) {
          handleSaveProject();
        }
      } else if (modKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        if (selectedClip && !isExporting) {
          handleExport();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedClip, isExporting, isSaving, currentView, currentProjectId]); // Re-bind when these change

  // Render Dashboard view
  if (currentView === "dashboard") {
    return (
      <Dashboard
        onOpenProject={handleOpenProject}
        onNewProject={handleNewProject}
      />
    );
  }

  // Render Editing Screen view
  return (
    <div className="app-container">
      <div className="app-topbar">
        <TopBar
          onImportClick={handleSelectFiles}
          onExportClick={handleExport}
          isExporting={isExporting}
          exportDisabled={!selectedClip}
          onBackToDashboard={handleBackToDashboard}
          projectId={currentProjectId}
          onSaveClick={() => handleSaveProject(true)}
          isSaving={isSaving}
          lastSaved={lastSaved}
          onNewProject={handleNewProject}
          onOpenProject={handleBackToDashboard}
          onRecordingModeSelect={handleRecordingModeSelect}
        />
      </div>

      <div className="app-main-content">
        <div className="app-media-library">
          <MediaLibrary
            clips={clips}
            selectedClipId={selectedClipId}
            onSelectClip={setSelectedClipId}
            onImportClips={handleImportClips}
            onRelinkMedia={handleRelinkMedia}
            onUpdateClipThumbnail={handleUpdateClipThumbnail}
            onRemoveClip={handleRemoveClip}
            onRenameClip={handleRenameClip}
          />
        </div>

        <div className="app-preview">
          <PreviewPanel
            clip={selectedClip}
            onCurrentTimeChange={setCurrentTime}
            onSeekTo={handleSeekTo}
            sequence={timelineSequence}
            media={timelineMedia}
            playheadMs={playheadMs}
            onPlayheadChange={setPlayheadMs}
          />
        </div>

        <div className="app-properties">
          <PropertiesPanel
            clip={selectedClip}
            onUpdateTrim={handleUpdateTrim}
            onExport={handleTimelineExport}
            isExporting={isExporting}
            projectId={currentProjectId}
            projectTitle={projectTitle}
            projectThumbnailUrl={projectThumbnailUrl}
            onUpdateProjectTitle={handleUpdateProjectTitle}
            onUpdateProjectThumbnail={handleUpdateProjectThumbnail}
            onClearProjectThumbnail={handleClearProjectThumbnail}
            selectedOverlay={selectedOverlay}
            onUpdateOverlay={handleUpdateOverlay}
            onDeleteOverlay={handleDeleteOverlay}
          />
        </div>
      </div>

      <div className="app-timeline" style={{ height: `${timelineHeight}px` }}>
        <div
          className="app-timeline-resize-handle"
          onMouseDown={handleTimelineResizeStart}
        />
        <ProTimeline
          sequence={timelineSequence}
          media={timelineMedia}
          playheadMs={playheadMs}
          onSequenceChange={setTimelineSequence}
          onSeek={setPlayheadMs}
          onMediaAdd={(mediaId, mediaInfo) => {
            setTimelineMedia((prev) => ({
              ...prev,
              [mediaId]: mediaInfo,
            }));
          }}
          selectedOverlayId={selectedOverlayId}
          onSelectOverlay={setSelectedOverlayId}
        />
      </div>

      {/* Recording Panel Modal (triggered by menu) */}
      {showRecordingPanel && (
        <div
          className="recording-modal-overlay"
          onClick={() => {
            setShowRecordingPanel(false);
            setRecordingMode(null);
          }}
        >
          <div
            className="recording-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <RecordingPanel
              projectId={currentProjectId}
              onRecordingComplete={handleRecordingComplete}
              mode={recordingMode}
              onClose={() => {
                setShowRecordingPanel(false);
                setRecordingMode(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Export Progress Indicator (top-right corner) */}
      {isExporting && (
        <div className="export-indicator">
          <div className="export-indicator-spinner"></div>
          <span>Exporting...</span>
        </div>
      )}

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </div>
  );
};

export default App;
