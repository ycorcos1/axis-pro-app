/**
 * Main React application component
 * @mem ref: arch-fwk, design-spec, pr5-import, pr6-timeline, pr7-preview-player, pr8-export, pr9-dashboard
 * Main UI layout per Axis Pro Design Specification
 * Manages global app state including imported clips and timeline trim state
 * Routes between Dashboard and Editing Screen
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import Dashboard from "./components/Dashboard";
import TopBar from "./components/TopBar";
import MediaLibrary from "./components/MediaLibrary";
import PreviewPanel from "./components/PreviewPanel";
import Timeline from "./components/Timeline";
import PropertiesPanel from "./components/PropertiesPanel";
import Toast, { Toast as ToastType } from "./components/Toast";
import "./styles/theme.css";
import "./styles/layout.css";

// Import Clip type from shared types
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

  // Global state for imported clips
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0); // Current playback time in ms

  // Reset currentTime when clip changes
  useEffect(() => {
    setCurrentTime(0);
  }, [selectedClipId]);

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

  /**
   * Show a toast notification
   */
  const showToast = (message: string, type: ToastType["type"] = "info") => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
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
  const handleSaveProject = async (manual: boolean = false, clipsToSave?: Clip[]) => {
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

      // Convert clips from editing format to project format
      const projectClips: Record<string, any> = {};
      clipsForSave.forEach((clip) => {
        projectClips[clip.id] = {
          id: clip.id,
          path: clip.path,
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

      // Update project with current state
      project.clips = projectClips;
      project.segments = segments;

      // Save the project
      await window.electronAPI.saveProject(project);
      console.log("[App] Project saved with", Object.keys(projectClips).length, "clips");

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
      for (const [clipId, projectClip] of Object.entries(project.clips)) {
        const clip = projectClip as any;

        loadedClips.push({
          id: clip.id,
          path: clip.path,
          filename: clip.path.split(/[/\\]/).pop() || "Unknown",
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

      setClips(loadedClips);
      setProjectTitle(project.title || "Untitled Project");
      console.log("[App] Project state loaded:", loadedClips.length, "clips");
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
    const updatedClips = clips.filter((clip) => clip.id !== clipId);
    setClips(updatedClips);
    
    // If the removed clip was selected, clear selection
    if (selectedClipId === clipId) {
      setSelectedClipId(null);
    }
    
    showToast("Clip removed from project", "info");
    
    // Auto-save after removal
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

  // Handle timeline click to seek
  const handleSeekTo = (timeMs: number) => {
    // Use the exposed seek function from PreviewPanel
    if ((window as any).__previewSeek) {
      (window as any).__previewSeek(timeMs);
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
  console.log("[App] Current view:", currentView);

  if (currentView === "dashboard") {
    console.log("[App] Rendering Dashboard");
    return (
      <Dashboard
        onOpenProject={handleOpenProject}
        onNewProject={handleNewProject}
      />
    );
  }

  console.log("[App] Rendering Editor");

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
          />
        </div>

        <div className="app-preview">
          <PreviewPanel
            clip={selectedClip}
            onCurrentTimeChange={setCurrentTime}
            onSeekTo={handleSeekTo}
          />
        </div>

        <div className="app-properties">
          <PropertiesPanel
            clip={selectedClip}
            onUpdateTrim={handleUpdateTrim}
            onExport={handleExport}
            projectId={currentProjectId}
            projectTitle={projectTitle}
            onUpdateProjectTitle={handleUpdateProjectTitle}
          />
        </div>
      </div>

      <div className="app-timeline">
        <Timeline
          clip={selectedClip}
          currentTime={currentTime}
          onUpdateTrim={handleUpdateTrim}
          onSeek={handleSeekTo}
        />
      </div>

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
