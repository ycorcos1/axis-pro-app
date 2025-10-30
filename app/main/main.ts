/**
 * Main Electron process for Axis Pro
 * @mem ref: arch-fwk, ipc-surface
 * Handles window creation, application lifecycle, and IPC communication
 */

// Load environment variables FIRST (before any other imports that might use them)
import dotenv from "dotenv";
dotenv.config();

import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  safeStorage,
  Menu,
} from "electron";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import { fileURLToPath } from "url";
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
import * as ffmpegService from "./ffmpegService.js";
import * as projectIO from "./projectIO.js";
import * as thumbService from "./thumbService.js";
import * as recordingService from "./recordingService.js";
import * as aiService from "./aiService.js";
import * as aiShortsService from "./aiShortsService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

// Register protocol schemes as privileged BEFORE app is ready
// This is required for the custom protocols to work with video elements and images
protocol.registerSchemesAsPrivileged([
  {
    scheme: "local-video",
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true, // Important for video streaming
    },
  },
  {
    scheme: "local-image",
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
    },
  },
]);

// Register custom protocols for local files
// This allows the renderer to access local video and image files safely
function registerLocalFileProtocol() {
  // Use interceptFileProtocol for better streaming support with video elements
  protocol.interceptFileProtocol("local-video", (request, callback) => {
    const url = request.url.replace("local-video://", "");
    try {
      const decodedPath = decodeURIComponent(url);
      console.log("[Protocol] Serving video file:", decodedPath);
      return callback({ path: decodedPath });
    } catch (error) {
      console.error("[Protocol] Error handling local-video request:", error);
      return callback({ error: -2 }); // FILE_NOT_FOUND
    }
  });

  // Register protocol for image files (thumbnails)
  protocol.interceptFileProtocol("local-image", (request, callback) => {
    const url = request.url.replace("local-image://", "");
    try {
      const decodedPath = decodeURIComponent(url);
      console.log("[Protocol] Serving image file:", decodedPath);
      return callback({ path: decodedPath });
    } catch (error) {
      console.error("[Protocol] Error handling local-image request:", error);
      return callback({ error: -2 }); // FILE_NOT_FOUND
    }
  });
}

function createWindow() {
  // Create the browser window
  // Determine preload path for dev vs production
  const isDev = !app.isPackaged;
  let preloadPath: string;

  if (isDev) {
    // In dev, __dirname is dist/main/main/, so go up 2 levels to dist/, then into preload
    preloadPath = path.join(__dirname, "../../preload/preload/preload.js");
  } else {
    // In production, files are packaged as: main/**/*, preload/**/*, and app/renderer/dist/**/*
    // From main/main/main.js: ../../preload/preload/preload.js
    preloadPath = path.join(__dirname, "../../preload/preload/preload.js");
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Axis Pro",
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Temporarily disable for video loading (will re-enable with better solution)
      sandbox: false, // Disable sandbox to allow file path access from drag-and-drop
    },
    backgroundColor: "#121212",
  });

  console.log("[Main] __dirname:", __dirname);
  console.log("[Main] Preload path:", preloadPath);

  // Check if preload file exists
  if (fs.existsSync(preloadPath)) {
    console.log("[Main] ✓ Preload file exists");
  } else {
    console.error("[Main] ✗ Preload file NOT FOUND");
  }

  // Listen for console messages to catch preload logs
  mainWindow.webContents.on("console-message", (event, level, message) => {
    if (message.includes("[Preload]")) {
      console.log(`[Main->Preload] ${message}`);
    }
  });

  // Load the app (isDev already defined above)

  if (isDev) {
    // Try common Vite dev server ports
    mainWindow.loadURL("http://localhost:5173").catch(() => {
      mainWindow?.loadURL("http://localhost:5174").catch(() => {
        mainWindow?.loadURL("http://localhost:5175").catch(() => {
          console.error("Could not connect to Vite dev server");
        });
      });
    });
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from the packaged renderer directory
    // Files are packaged as: /dist/main/main/main.js and /app/renderer/dist/renderer/index.html
    // So from /dist/main/main/, need to go up 3 levels to root, then into app/renderer
    const rendererPath = path.join(
      __dirname,
      "../../../app/renderer/dist/renderer/index.html"
    );
    console.log("[Main] Loading renderer from:", rendererPath);
    mainWindow.loadFile(rendererPath);
  }
}

/**
 * Create application menu with recording options
 * @mem ref: pr13-recording-suite
 */
function createApplicationMenu() {
  const isMac = process.platform === "darwin";

  const template: any[] = [
    // App Menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),

    // File Menu
    {
      label: "File",
      submenu: [
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow?.webContents.send("menu-new-project");
          },
        },
        {
          label: "Open Project",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            mainWindow?.webContents.send("menu-open-project");
          },
        },
        { type: "separator" },
        {
          label: "Import Media",
          accelerator: "CmdOrCtrl+I",
          click: () => {
            mainWindow?.webContents.send("menu-import-media");
          },
        },
        { type: "separator" },
        {
          label: "New Movie Recording",
          accelerator: isMac ? "Cmd+Ctrl+M" : "Ctrl+Shift+M",
          click: () => {
            mainWindow?.webContents.send("menu-record-movie");
          },
        },
        {
          label: "New Audio Recording",
          accelerator: isMac ? "Cmd+Ctrl+A" : "Ctrl+Shift+A",
          click: () => {
            mainWindow?.webContents.send("menu-record-audio");
          },
        },
        {
          label: "New Screen Recording",
          accelerator: isMac ? "Cmd+Ctrl+S" : "Ctrl+Shift+S",
          click: () => {
            mainWindow?.webContents.send("menu-record-screen");
          },
        },
        {
          label: "New Screen Recording with Camera",
          accelerator: isMac ? "Cmd+Ctrl+C" : "Ctrl+Shift+C",
          click: () => {
            mainWindow?.webContents.send("menu-record-screen-camera");
          },
        },
        { type: "separator" },
        {
          label: "Export",
          accelerator: "CmdOrCtrl+E",
          click: () => {
            mainWindow?.webContents.send("menu-export");
          },
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },

    // Edit Menu
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "delete" },
        { role: "selectAll" },
      ],
    },

    // View Menu
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },

    // Window Menu
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [
              { type: "separator" },
              { role: "front" },
              { type: "separator" },
              { role: "window" },
            ]
          : [{ role: "close" }]),
      ],
    },

    // Help Menu
    {
      role: "help",
      submenu: [
        {
          label: "Learn More",
          click: async () => {
            const { shell } = await import("electron");
            await shell.openExternal("https://github.com/axis-pro/axis-pro");
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * IPC Handlers
 * @mem ref: ipc-surface
 */

// File selection dialog
ipcMain.handle("select-files", async () => {
  if (!mainWindow) return [];

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Videos", extensions: ["mp4", "mov", "avi", "mkv", "webm"] },
    ],
  });

  return result.canceled ? [] : result.filePaths;
});

// File save dialog for export
ipcMain.handle(
  "select-save-path",
  async (_event, defaultFilename: string): Promise<string | null> => {
    if (!mainWindow) return null;

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultFilename,
      filters: [{ name: "Video", extensions: ["mp4"] }],
      properties: ["createDirectory"],
    });

    return result.canceled ? null : result.filePath;
  }
);

// Check FFmpeg availability
ipcMain.handle("check-ffmpeg", async () => {
  return await ffmpegService.checkFFmpegAvailability();
});

// Media probe - returns media metadata
// Uses ffprobe to extract video file information
ipcMain.handle(
  "probe",
  async (_event, filePath: string): Promise<MediaInfo> => {
    console.log("[IPC] probe called for:", filePath);

    try {
      const mediaInfo = await ffmpegService.probe(filePath);
      console.log("[IPC] probe successful:", mediaInfo);
      return mediaInfo;
    } catch (error) {
      console.error("[IPC] probe failed:", error);
      throw error;
    }
  }
);

// Import clips - probes files and creates Clip objects
ipcMain.handle(
  "import-clips",
  async (_event, paths: string[]): Promise<Clip[]> => {
    console.log("[IPC] import-clips called with paths:", paths);

    try {
      // Probe each file in parallel for better performance
      const probePromises = paths.map((filePath) =>
        ffmpegService.probe(filePath)
      );
      const mediaInfos = await Promise.all(probePromises);

      // Convert MediaInfo objects to Clip objects
      const clips: Clip[] = mediaInfos.map((mediaInfo, index) => {
        const filename = path.basename(mediaInfo.path);

        return {
          id: `clip-${Date.now()}-${index}`,
          path: mediaInfo.path,
          filename,
          duration: mediaInfo.duration,
          width: mediaInfo.width,
          height: mediaInfo.height,
          inMs: 0,
          outMs: mediaInfo.duration,
        };
      });

      console.log(
        "[IPC] import-clips successful:",
        clips.length,
        "clips imported"
      );
      return clips;
    } catch (error) {
      console.error("[IPC] import-clips failed:", error);
      throw error;
    }
  }
);

// Generate thumbnail for a clip
ipcMain.handle(
  "generate-clip-thumbnail",
  async (_event, clipPath: string, clipId: string): Promise<string | null> => {
    console.log("[IPC] generate-clip-thumbnail called:", clipId);

    try {
      // First, probe the file to check if it has video
      const mediaInfo = await ffmpegService.probe(clipPath);

      // If file has no video (audio-only), skip thumbnail generation
      if (mediaInfo.width === 0 || mediaInfo.height === 0) {
        console.log(
          `[IPC] Skipping thumbnail for audio-only clip: ${clipPath}`
        );
        return null;
      }

      // Generate thumbnail path in user cache
      const userDataPath = app.getPath("userData");
      const thumbsDir = path.join(userDataPath, "thumbnails");
      await import("fs/promises").then((fs) =>
        fs.mkdir(thumbsDir, { recursive: true })
      );
      const thumbPath = path.join(thumbsDir, `${clipId}.jpg`);

      // Generate thumbnail using thumbService
      await thumbService.generateThumbnail(clipPath, thumbPath);

      console.log("[IPC] generate-clip-thumbnail successful:", thumbPath);
      return thumbPath;
    } catch (error) {
      console.error("[IPC] generate-clip-thumbnail failed:", error);
      return null;
    }
  }
);

// Export timeline segment
// Uses FFmpeg to trim and export video
ipcMain.handle(
  "export-timeline",
  async (
    _event,
    segment: TimelineSegment,
    targetPath: string,
    options?: ExportOptions
  ): Promise<ExportResult> => {
    console.log("[IPC] export-timeline called");
    console.log("  Segment:", segment);
    console.log("  Target:", targetPath);
    console.log("  Options:", options);

    try {
      await ffmpegService.trimExport(
        segment.clipPath,
        segment.inMs,
        segment.outMs,
        targetPath,
        options
      );

      const exportResult: ExportResult = {
        success: true,
        outputPath: targetPath,
        duration: segment.outMs - segment.inMs,
      };

      console.log("[IPC] export-timeline successful:", exportResult);
      return exportResult;
    } catch (error) {
      console.error("[IPC] export-timeline failed:", error);

      return {
        success: false,
        outputPath: targetPath,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: segment.outMs - segment.inMs,
      };
    }
  }
);

/**
 * Project IPC Handlers
 * @mem ref: pr9-dashboard
 */

// List all projects
ipcMain.handle("list-projects", async (): Promise<ProjectMetadata[]> => {
  console.log("[IPC] list-projects called");

  try {
    const projects = await projectIO.listProjects();
    console.log(`[IPC] list-projects successful: ${projects.length} projects`);
    return projects;
  } catch (error) {
    console.error("[IPC] list-projects failed:", error);
    return [];
  }
});

// Create a new project
ipcMain.handle(
  "create-project",
  async (_event, title: string): Promise<Project> => {
    console.log("[IPC] create-project called with title:", title);

    try {
      const project = await projectIO.createProject(title);
      console.log("[IPC] create-project successful:", project.id);
      return project;
    } catch (error) {
      console.error("[IPC] create-project failed:", error);
      throw error;
    }
  }
);

// Load a project
ipcMain.handle(
  "load-project",
  async (_event, projectId: string): Promise<Project | null> => {
    console.log("[IPC] load-project called:", projectId);

    try {
      const project = await projectIO.loadProject(projectId);
      console.log(
        "[IPC] load-project successful:",
        project ? project.id : "not found"
      );
      return project;
    } catch (error) {
      console.error("[IPC] load-project failed:", error);
      return null;
    }
  }
);

// Save a project
ipcMain.handle(
  "save-project",
  async (_event, project: Project): Promise<void> => {
    console.log("[IPC] save-project called:", project.id);

    try {
      await projectIO.saveProject(project);
      console.log("[IPC] save-project successful");
    } catch (error) {
      console.error("[IPC] save-project failed:", error);
      throw error;
    }
  }
);

// Rename a project
ipcMain.handle(
  "rename-project",
  async (_event, projectId: string, newTitle: string): Promise<void> => {
    console.log("[IPC] rename-project called:", projectId, newTitle);

    try {
      await projectIO.renameProject(projectId, newTitle);
      console.log("[IPC] rename-project successful");
    } catch (error) {
      console.error("[IPC] rename-project failed:", error);
      throw error;
    }
  }
);

// Duplicate a project
ipcMain.handle(
  "duplicate-project",
  async (_event, projectId: string): Promise<Project> => {
    console.log("[IPC] duplicate-project called:", projectId);

    try {
      const newProject = await projectIO.duplicateProject(projectId);
      console.log("[IPC] duplicate-project successful:", newProject.id);
      return newProject;
    } catch (error) {
      console.error("[IPC] duplicate-project failed:", error);
      throw error;
    }
  }
);

// Delete a project
ipcMain.handle(
  "delete-project",
  async (_event, projectId: string): Promise<void> => {
    console.log("[IPC] delete-project called:", projectId);

    try {
      await projectIO.deleteProject(projectId);
      console.log("[IPC] delete-project successful");
    } catch (error) {
      console.error("[IPC] delete-project failed:", error);
      throw error;
    }
  }
);

// Generate project thumbnail
ipcMain.handle(
  "generate-project-thumbnail",
  async (_event, projectId: string, videoPath: string): Promise<void> => {
    console.log("[IPC] generate-project-thumbnail called:", projectId);

    try {
      await thumbService.generateProjectThumbnail(projectId, videoPath);
      console.log("[IPC] generate-project-thumbnail successful");
    } catch (error) {
      console.error("[IPC] generate-project-thumbnail failed:", error);
      throw error;
    }
  }
);

// Set project thumbnail from user-selected image file
ipcMain.handle(
  "set-project-thumbnail-from-file",
  async (
    _event,
    projectId: string,
    imagePath: string
  ): Promise<string | null> => {
    console.log(
      "[IPC] set-project-thumbnail-from-file called:",
      projectId,
      imagePath
    );

    try {
      const fs = await import("fs/promises");
      const path = await import("path");

      // Get the project thumbnail path
      const thumbPath = projectIO.getProjectThumbPath(projectId);

      // Copy the selected image to the thumbnail location
      await fs.copyFile(imagePath, thumbPath);
      console.log("[IPC] Thumbnail copied to:", thumbPath);

      // Update project metadata
      const project = await projectIO.loadProject(projectId);
      if (project) {
        project.previewThumbPath = thumbPath;
        await projectIO.saveProject(project);
        console.log("[IPC] Project metadata updated with thumbnail path");
      }

      return thumbPath;
    } catch (error) {
      console.error("[IPC] set-project-thumbnail-from-file failed:", error);
      return null;
    }
  }
);

// Show open dialog for file selection
ipcMain.handle(
  "show-open-dialog",
  async (_event, options: any): Promise<string[]> => {
    console.log("[IPC] show-open-dialog called with options:", options);

    try {
      const result = await dialog.showOpenDialog(options);
      console.log("[IPC] Dialog result:", result);
      return result.filePaths;
    } catch (error) {
      console.error("[IPC] show-open-dialog failed:", error);
      return [];
    }
  }
);

// Handle file path extraction from dropped files
ipcMain.on("get-file-path", (event, channel: string, file: any) => {
  console.log("[IPC] get-file-path called for file:", file);

  try {
    // In Electron, dropped files should have a path property
    const path = file.path;
    console.log("[IPC] Extracted path:", path);

    if (path) {
      event.sender.send(channel, path);
    } else {
      console.error("[IPC] No path found in file object");
      event.sender.send(channel, "");
    }
  } catch (error) {
    console.error("[IPC] Error extracting file path:", error);
    event.sender.send(channel, "");
  }
});

/**
 * Recording IPC Handlers
 * @mem ref: pr13-recording-suite
 */

// Get available desktop sources (screens and windows)
ipcMain.handle("get-desktop-sources", async (): Promise<DesktopSource[]> => {
  console.log("[IPC] get-desktop-sources called");

  try {
    const sources = await recordingService.getDesktopSources();
    console.log(
      `[IPC] get-desktop-sources successful: ${sources.length} sources`
    );
    return sources;
  } catch (error) {
    console.error("[IPC] get-desktop-sources failed:", error);
    return [];
  }
});

// Remux WebM recording to MP4
ipcMain.handle(
  "remux-recording",
  async (_event, inputPath: string, outputPath: string): Promise<void> => {
    console.log("[IPC] remux-recording called");
    console.log("  Input:", inputPath);
    console.log("  Output:", outputPath);

    try {
      await ffmpegService.remuxWebMToMP4(inputPath, outputPath);
      console.log("[IPC] remux-recording successful");
    } catch (error) {
      console.error("[IPC] remux-recording failed:", error);
      throw error;
    }
  }
);

// Save recording chunk (for streaming saves)
ipcMain.handle(
  "save-recording-chunk",
  async (
    _event,
    projectId: string,
    fileName: string,
    data: ArrayBuffer
  ): Promise<string> => {
    console.log("[IPC] save-recording-chunk called:", fileName);

    try {
      const projectDir = projectIO.getProjectPath(projectId);
      const recordingsDir = path.join(projectDir, "recordings");

      // Ensure recordings directory exists
      await import("fs/promises").then((fs) =>
        fs.mkdir(recordingsDir, { recursive: true })
      );

      const filePath = path.join(recordingsDir, fileName);

      // Append data to file
      await import("fs/promises").then((fs) =>
        fs.appendFile(filePath, Buffer.from(data))
      );

      console.log("[IPC] save-recording-chunk successful:", filePath);
      return filePath;
    } catch (error) {
      console.error("[IPC] save-recording-chunk failed:", error);
      throw error;
    }
  }
);

/**
 * Timeline Media Services IPC Handlers
 * @mem ref: pr14-timeline
 */

// Generate thumbnail strip for a media file
ipcMain.handle(
  "media:thumbs",
  async (_event, mediaId: string, mediaPath: string): Promise<string> => {
    console.log("[IPC] media:thumbs called for:", mediaId);

    try {
      const cacheDir = path.join(
        app.getPath("userData"),
        "cache",
        "thumbs",
        mediaId
      );

      const thumbsDir = await ffmpegService.generateThumbnailStrip(
        mediaPath,
        cacheDir,
        2 // 2 fps = 1 thumb every 0.5s
      );

      console.log("[IPC] media:thumbs successful:", thumbsDir);
      return thumbsDir;
    } catch (error) {
      console.error("[IPC] media:thumbs failed:", error);
      throw error;
    }
  }
);

// Generate waveform for a media file
ipcMain.handle(
  "media:waveform",
  async (_event, mediaId: string, mediaPath: string): Promise<string> => {
    console.log("[IPC] media:waveform called for:", mediaId);

    try {
      const cacheDir = path.join(app.getPath("userData"), "cache", "waveforms");

      // Ensure cache directory exists
      await import("fs/promises").then((fs) =>
        fs.mkdir(cacheDir, { recursive: true })
      );

      const outputPath = path.join(cacheDir, `${mediaId}.png`);

      const waveformPath = await ffmpegService.generateWaveform(
        mediaPath,
        outputPath,
        1200,
        200
      );

      console.log("[IPC] media:waveform successful:", waveformPath);
      return waveformPath;
    } catch (error) {
      console.error("[IPC] media:waveform failed:", error);
      throw error;
    }
  }
);

// Probe media and return full MediaInfo (for timeline)
ipcMain.handle(
  "media:probe",
  async (_event, filePath: string): Promise<any> => {
    console.log("[IPC] media:probe called for:", filePath);

    try {
      const mediaInfo = await ffmpegService.probe(filePath);

      // Determine if has video and audio based on dimensions and codec
      const hasVideo = mediaInfo.width > 0 && mediaInfo.height > 0;
      const hasAudio =
        mediaInfo.codec.includes("aac") ||
        mediaInfo.codec.includes("mp3") ||
        mediaInfo.codec.includes("opus") ||
        mediaInfo.codec.includes("vorbis") ||
        // For video files, assume they have audio unless audio-only codec detected
        (hasVideo &&
          !mediaInfo.codec.includes("h264") &&
          !mediaInfo.codec.includes("vp"));

      // Convert to timeline MediaInfo format
      const timelineMediaInfo = {
        id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        path: filePath,
        kind: !hasVideo && hasAudio ? "audio" : "video",
        durationMs: mediaInfo.duration,
        streams: {
          v: hasVideo
            ? {
                fps: mediaInfo.fps,
                w: mediaInfo.width,
                h: mediaInfo.height,
              }
            : undefined,
          a: {
            rate: 48000, // Default sample rate
            channels: 2, // Default stereo
          },
        },
      };

      console.log("[IPC] media:probe successful:", timelineMediaInfo);
      return timelineMediaInfo;
    } catch (error) {
      console.error("[IPC] media:probe failed:", error);
      throw error;
    }
  }
);

// Export sequence (timeline export)
ipcMain.handle(
  "timeline:export",
  async (
    _event,
    exportData: { sequence: any; media: any; outputPath: string }
  ): Promise<any> => {
    console.log("[IPC] timeline:export called");

    try {
      const { sequence, media, outputPath } = exportData;

      console.log("[IPC] Export data received:");
      console.log("  Sequence tracks:", sequence?.tracks?.length);
      console.log("  Media count:", Object.keys(media || {}).length);
      console.log("  Output path:", outputPath);

      // Build export command using exportBuilder
      const { buildExportCommand } = await import("../shared/exportBuilder.js");

      console.log("[IPC] Building export command...");
      const ffmpegArgs = buildExportCommand(sequence, media, outputPath);

      console.log("[IPC] Export command:", ffmpegArgs.join(" "));

      // Execute FFmpeg export
      const { spawn } = await import("child_process");
      const ffmpegPath = getFFmpegPath();

      console.log("[IPC] Using FFmpeg path:", ffmpegPath);

      return new Promise((resolve, reject) => {
        const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

        let stderr = "";

        ffmpegProcess.stderr.on("data", (data) => {
          stderr += data.toString();
          console.log("[FFmpeg]", data.toString().trim());
        });

        ffmpegProcess.on("close", (code) => {
          if (code !== 0) {
            const errorMsg = `FFmpeg failed with code ${code}: ${stderr}`;
            console.error("[IPC] FFmpeg error:", errorMsg);
            reject({
              success: false,
              error: errorMsg,
            });
            return;
          }

          console.log("[IPC] timeline:export successful");
          resolve({ success: true, outputPath });
        });

        ffmpegProcess.on("error", (error) => {
          const errorMsg = `Failed to spawn FFmpeg: ${error.message}`;
          console.error("[IPC] Spawn error:", errorMsg);
          reject({
            success: false,
            error: errorMsg,
          });
        });
      });
    } catch (error) {
      console.error("[IPC] timeline:export failed:", error);
      const errorMsg =
        error instanceof Error
          ? error.message
          : typeof error === "string"
          ? error
          : JSON.stringify(error);

      return {
        success: false,
        error: errorMsg,
      };
    }
  }
);

// Helper to get FFmpeg path (needed for export)
function getFFmpegPath(): string {
  const platformDir = process.platform === "darwin" ? "mac" : process.platform;
  const binaryName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

  if (app.isPackaged) {
    return path.join(process.resourcesPath, "ffmpeg", platformDir, binaryName);
  }

  const appPath = app.getAppPath();
  if (appPath.includes("/dist/") || appPath.includes("\\dist\\")) {
    const projectRoot = appPath.includes("/dist/")
      ? appPath.split("/dist/")[0]
      : appPath.split("\\dist\\")[0];
    return path.join(
      projectRoot,
      "resources",
      "ffmpeg",
      platformDir,
      binaryName
    );
  }

  return path.join(appPath, "resources", "ffmpeg", platformDir, binaryName);
}

/**
 * AI Shorts IPC Handlers
 * @mem ref: pr17-ai-shorts
 */

// Check if AI Shorts feature is available
ipcMain.handle("ai-shorts:check-available", async (): Promise<boolean> => {
  console.log("[IPC] ai-shorts:check-available called");
  const available = aiShortsService.isAIShortsAvailable();
  console.log("[IPC] AI Shorts available:", available);
  return available;
});

// Generate AI shorts from a video
ipcMain.handle(
  "ai-shorts:generate",
  async (
    _event,
    videoPath: string,
    projectId: string,
    numShorts: number = 5
  ): Promise<any> => {
    console.log("[IPC] ai-shorts:generate called");
    console.log("  Video:", videoPath);
    console.log("  Project:", projectId);
    console.log("  NumShorts:", numShorts);

    try {
      // Generate shorts with progress updates sent back to renderer
      const result = await aiShortsService.generateAIShorts(
        videoPath,
        projectId,
        (progress) => {
          // Send progress updates to renderer
          if (mainWindow) {
            mainWindow.webContents.send("ai-shorts:progress", progress);
          }
        },
        numShorts
      );

      console.log("[IPC] ai-shorts:generate complete:", result.success);
      return result;
    } catch (error: any) {
      console.error("[IPC] ai-shorts:generate failed:", error);
      return {
        success: false,
        shorts: [],
        error: error.message,
      };
    }
  }
);

// Load existing AI shorts for a project
ipcMain.handle(
  "ai-shorts:load",
  async (_event, projectId: string): Promise<any[]> => {
    console.log("[IPC] ai-shorts:load called for project:", projectId);

    try {
      const shorts = await aiShortsService.loadExistingShorts(projectId);
      console.log("[IPC] ai-shorts:load complete:", shorts.length, "shorts");
      return shorts;
    } catch (error: any) {
      console.error("[IPC] ai-shorts:load failed:", error);
      return [];
    }
  }
);

// Generate MORE AI shorts from the same video
ipcMain.handle(
  "ai-shorts:generate-more",
  async (
    _event,
    videoPath: string,
    projectId: string,
    existingShorts: any[],
    numShorts: number = 5
  ): Promise<any> => {
    console.log("[IPC] ai-shorts:generate-more called");
    console.log("  Video:", videoPath);
    console.log("  Project:", projectId);
    console.log("  Existing shorts:", existingShorts.length);
    console.log("  NumShorts:", numShorts);

    try {
      const result = await aiShortsService.generateMoreAIShorts(
        videoPath,
        projectId,
        existingShorts,
        (progress) => {
          if (mainWindow) {
            mainWindow.webContents.send("ai-shorts:progress", progress);
          }
        },
        numShorts
      );

      console.log("[IPC] ai-shorts:generate-more complete:", result.success);
      return result;
    } catch (error: any) {
      console.error("[IPC] ai-shorts:generate-more failed:", error);
      return {
        success: false,
        shorts: [],
        error: error.message,
      };
    }
  }
);

// Copy file IPC handler (for exporting AI shorts)
ipcMain.handle(
  "file:copy",
  async (_event, sourcePath: string, destPath: string): Promise<boolean> => {
    console.log("[IPC] file:copy called");
    console.log("  Source:", sourcePath);
    console.log("  Dest:", destPath);

    try {
      await fsPromises.copyFile(sourcePath, destPath);
      console.log("[IPC] file:copy complete");
      return true;
    } catch (error: any) {
      console.error("[IPC] file:copy failed:", error);
      throw error;
    }
  }
);

// App event handlers
app.whenReady().then(() => {
  // Initialize OpenAI client (if API key is available)
  try {
    aiService.initializeOpenAI();
  } catch (error) {
    console.warn(
      "[Main] AI features disabled: OpenAI client initialization failed:",
      error
    );
  }

  // Register custom protocol before creating window
  registerLocalFileProtocol();

  createWindow();
  createApplicationMenu();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      createApplicationMenu();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
