/**
 * Preload script for secure IPC communication
 * @mem ref: ipc-surface
 * Exposes safe APIs to the renderer process via contextBridge
 */

console.log("[Preload] Script is executing!");

import { contextBridge, ipcRenderer, webUtils } from "electron";
import type {
  Clip,
  MediaInfo,
  TimelineSegment,
  ExportOptions,
  ExportResult,
  Project,
  ProjectMetadata,
  DesktopSource,
} from "../shared/types.js";

// Expose secure IPC APIs to renderer
console.log("[Preload] About to expose electronAPI to window");
contextBridge.exposeInMainWorld("electronAPI", {
  // Platform info
  platform: process.platform,

  // File selection
  selectFiles: (): Promise<string[]> => {
    return ipcRenderer.invoke("select-files");
  },

  // File save dialog for export
  selectSavePath: (defaultFilename: string): Promise<string | null> => {
    return ipcRenderer.invoke("select-save-path", defaultFilename);
  },

  // Get file path from File object (for drag-and-drop)
  getFilePathFromFile: (file: File): string => {
    return webUtils.getPathForFile(file);
  },

  // FFmpeg availability check
  checkFFmpeg: (): Promise<{
    ffmpegAvailable: boolean;
    ffprobeAvailable: boolean;
    ffmpegPath: string;
    ffprobePath: string;
  }> => {
    return ipcRenderer.invoke("check-ffmpeg");
  },

  // Media probing
  probe: (path: string): Promise<MediaInfo> => {
    return ipcRenderer.invoke("probe", path);
  },

  // Import clips
  importClips: (paths: string[]): Promise<Clip[]> => {
    return ipcRenderer.invoke("import-clips", paths);
  },

  // Show open dialog for file selection
  showOpenDialog: (options: any): Promise<string[]> => {
    return ipcRenderer.invoke("show-open-dialog", options);
  },

  // Generate clip thumbnail
  generateClipThumbnail: (
    clipPath: string,
    clipId: string
  ): Promise<string | null> => {
    return ipcRenderer.invoke("generate-clip-thumbnail", clipPath, clipId);
  },

  // Export timeline
  exportTimeline: (
    segment: TimelineSegment,
    targetPath: string,
    options?: ExportOptions
  ): Promise<ExportResult> => {
    return ipcRenderer.invoke("export-timeline", segment, targetPath, options);
  },

  // Project operations
  listProjects: (): Promise<ProjectMetadata[]> => {
    return ipcRenderer.invoke("list-projects");
  },

  createProject: (title: string): Promise<Project> => {
    return ipcRenderer.invoke("create-project", title);
  },

  loadProject: (projectId: string): Promise<Project | null> => {
    return ipcRenderer.invoke("load-project", projectId);
  },

  saveProject: (project: Project): Promise<void> => {
    return ipcRenderer.invoke("save-project", project);
  },

  renameProject: (projectId: string, newTitle: string): Promise<void> => {
    return ipcRenderer.invoke("rename-project", projectId, newTitle);
  },

  duplicateProject: (projectId: string): Promise<Project> => {
    return ipcRenderer.invoke("duplicate-project", projectId);
  },

  deleteProject: (projectId: string): Promise<void> => {
    return ipcRenderer.invoke("delete-project", projectId);
  },

  generateProjectThumbnail: (
    projectId: string,
    videoPath: string
  ): Promise<void> => {
    return ipcRenderer.invoke(
      "generate-project-thumbnail",
      projectId,
      videoPath
    );
  },

  setProjectThumbnailFromFile: (
    projectId: string,
    imagePath: string
  ): Promise<string | null> => {
    return ipcRenderer.invoke(
      "set-project-thumbnail-from-file",
      projectId,
      imagePath
    );
  },

  // Send file to main process to extract path
  sendFileToMain: (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const channel = `get-file-path-${Date.now()}`;

      // Create a one-time listener
      ipcRenderer.once(channel, (_, path: string) => {
        resolve(path);
      });

      // Send file to main process
      ipcRenderer.send("get-file-path", channel, file);
    });
  },

  // Get file path from File object using webUtils (Electron 22+)
  getFilePath: (file: File): string => {
    return webUtils.getPathForFile(file);
  },

  // Recording APIs
  getDesktopSources: (): Promise<DesktopSource[]> => {
    return ipcRenderer.invoke("get-desktop-sources");
  },

  remuxRecording: (inputPath: string, outputPath: string): Promise<void> => {
    return ipcRenderer.invoke("remux-recording", inputPath, outputPath);
  },

  saveRecordingChunk: (
    projectId: string,
    fileName: string,
    data: ArrayBuffer
  ): Promise<string> => {
    return ipcRenderer.invoke(
      "save-recording-chunk",
      projectId,
      fileName,
      data
    );
  },

  // Timeline Media APIs (PR #14)
  media: {
    probe: (path: string) => ipcRenderer.invoke("media:probe", path),
    thumbs: (mediaId: string, mediaPath: string) =>
      ipcRenderer.invoke("media:thumbs", mediaId, mediaPath),
    waveform: (mediaId: string, mediaPath: string) =>
      ipcRenderer.invoke("media:waveform", mediaId, mediaPath),
  },

  // Timeline Export (PR #14)
  timeline: {
    exportSequence: (sequence: any, media: any, outputPath: string) =>
      ipcRenderer.invoke("timeline:export", { sequence, media, outputPath }),
  },

  // File operations
  copyFile: (sourcePath: string, destPath: string): Promise<boolean> =>
    ipcRenderer.invoke("file:copy", sourcePath, destPath),

  // AI Shorts APIs (PR #17)
  aiShorts: {
    checkAvailable: (): Promise<boolean> =>
      ipcRenderer.invoke("ai-shorts:check-available"),
    generate: (
      videoPath: string,
      projectId: string,
      numShorts?: number
    ): Promise<any> =>
      ipcRenderer.invoke("ai-shorts:generate", videoPath, projectId, numShorts),
    generateMore: (
      videoPath: string,
      projectId: string,
      existingShorts: any[],
      numShorts?: number
    ): Promise<any> =>
      ipcRenderer.invoke(
        "ai-shorts:generate-more",
        videoPath,
        projectId,
        existingShorts,
        numShorts
      ),
    load: (projectId: string): Promise<any[]> =>
      ipcRenderer.invoke("ai-shorts:load", projectId),
    onProgress: (callback: (progress: any) => void) => {
      const listener = (_event: any, progress: any) => callback(progress);
      ipcRenderer.on("ai-shorts:progress", listener);
      return () => ipcRenderer.removeListener("ai-shorts:progress", listener);
    },
  },

  // Menu event listeners (safe wrapper around ipcRenderer.on)
  onMenuEvent: (channel: string, callback: () => void) => {
    const validChannels = [
      "menu-new-project",
      "menu-open-project",
      "menu-import-media",
      "menu-record-movie",
      "menu-record-audio",
      "menu-record-screen",
      "menu-record-screen-camera",
      "menu-export",
    ];

    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },

  removeMenuListener: (channel: string, callback: () => void) => {
    const validChannels = [
      "menu-new-project",
      "menu-open-project",
      "menu-import-media",
      "menu-record-movie",
      "menu-record-audio",
      "menu-record-screen",
      "menu-record-screen-camera",
      "menu-export",
    ];

    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },
});

console.log("[Preload] electronAPI exposed successfully!");
console.log(
  "[Preload] Available methods:",
  Object.keys((global as any).electronAPI || {})
);

// Type definitions for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      platform: string;
      selectFiles: () => Promise<string[]>;
      selectSavePath: (defaultFilename: string) => Promise<string | null>;
      getFilePathFromFile: (file: File) => string;
      checkFFmpeg: () => Promise<{
        ffmpegAvailable: boolean;
        ffprobeAvailable: boolean;
        ffmpegPath: string;
        ffprobePath: string;
      }>;
      probe: (path: string) => Promise<MediaInfo>;
      importClips: (paths: string[]) => Promise<Clip[]>;
      showOpenDialog: (options: any) => Promise<string[]>;
      generateClipThumbnail: (
        clipPath: string,
        clipId: string
      ) => Promise<string | null>;
      exportTimeline: (
        segment: TimelineSegment,
        targetPath: string,
        options?: ExportOptions
      ) => Promise<ExportResult>;
      listProjects: () => Promise<ProjectMetadata[]>;
      createProject: (title: string) => Promise<Project>;
      loadProject: (projectId: string) => Promise<Project | null>;
      saveProject: (project: Project) => Promise<void>;
      renameProject: (projectId: string, newTitle: string) => Promise<void>;
      duplicateProject: (projectId: string) => Promise<Project>;
      deleteProject: (projectId: string) => Promise<void>;
      generateProjectThumbnail: (
        projectId: string,
        videoPath: string
      ) => Promise<void>;
      setProjectThumbnailFromFile: (
        projectId: string,
        imagePath: string
      ) => Promise<string | null>;
      sendFileToMain: (file: File) => Promise<string>;
      getDesktopSources: () => Promise<DesktopSource[]>;
      remuxRecording: (inputPath: string, outputPath: string) => Promise<void>;
      saveRecordingChunk: (
        projectId: string,
        fileName: string,
        data: ArrayBuffer
      ) => Promise<string>;
      media: {
        probe: (path: string) => Promise<any>;
        thumbs: (mediaId: string, mediaPath: string) => Promise<string>;
        waveform: (mediaId: string, mediaPath: string) => Promise<string>;
      };
      timeline: {
        exportSequence: (
          sequence: any,
          media: any,
          outputPath: string
        ) => Promise<any>;
      };
      copyFile: (sourcePath: string, destPath: string) => Promise<boolean>;
      aiShorts: {
        checkAvailable: () => Promise<boolean>;
        generate: (
          videoPath: string,
          projectId: string,
          numShorts?: number
        ) => Promise<any>;
        generateMore: (
          videoPath: string,
          projectId: string,
          existingShorts: any[],
          numShorts?: number
        ) => Promise<any>;
        load: (projectId: string) => Promise<any[]>;
        onProgress: (callback: (progress: any) => void) => () => void;
      };
      onMenuEvent: (channel: string, callback: () => void) => void;
      removeMenuListener: (channel: string, callback: () => void) => void;
    };
  }
}
