/**
 * Thumbnail Service
 * @mem ref: pr9-dashboard, ffmpeg-service
 * Generates project thumbnails using ffmpeg
 */

import { spawn } from "child_process";
import path from "path";
import { app } from "electron";
import fs from "fs/promises";
import { getProjectThumbPath, loadProject, saveProject } from "./projectIO.js";
import { probe } from "./ffmpegService.js";

/**
 * Get the path to bundled ffmpeg binary
 */
function getFFmpegPath(): string {
  if (app.isPackaged) {
    // In packaged app, ffmpeg is in resources/ffmpeg
    const resourcesPath = process.resourcesPath;
    return path.join(resourcesPath, "ffmpeg", "mac", "ffmpeg");
  } else {
    // In dev, ffmpeg is in resources/ffmpeg
    return path.join(process.cwd(), "resources", "ffmpeg", "mac", "ffmpeg");
  }
}

/**
 * Generate a thumbnail from a video file
 * Seeks to first non-black frame and scales to 960x540
 * @param videoPath - path to source video
 * @param outputPath - path to save thumbnail (should be .jpg)
 * @param maxSeekSeconds - maximum seconds to seek for non-black frame (default 10)
 */
export async function generateThumbnail(
  videoPath: string,
  outputPath: string,
  maxSeekSeconds: number = 10
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getFFmpegPath();

    // FFmpeg command to extract first non-black frame
    // -ss seeks to position, -i input, -vf applies filters
    // thumbnail filter finds representative frame
    // scale resizes to 960:-1 (maintains aspect ratio)
    const args = [
      "-ss",
      "0", // start from beginning
      "-i",
      videoPath,
      "-vf",
      "thumbnail,scale=960:-1",
      "-frames:v",
      "1", // output 1 frame
      "-q:v",
      "2", // high quality JPEG
      "-y", // overwrite
      outputPath,
    ];

    console.log("[ThumbService] Generating thumbnail:", videoPath);
    console.log("[ThumbService] Output:", outputPath);

    const process = spawn(ffmpegPath, args);

    let stderr = "";

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      if (code === 0) {
        console.log("[ThumbService] Thumbnail generated successfully");
        resolve();
      } else {
        console.error("[ThumbService] FFmpeg error:", stderr);
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    process.on("error", (error) => {
      console.error("[ThumbService] Failed to spawn ffmpeg:", error);
      reject(error);
    });
  });
}

/**
 * Generate thumbnail for a project from its first clip
 * Skips thumbnail generation for audio-only files
 * @param projectId - project ID
 * @param firstClipPath - path to first video clip
 */
export async function generateProjectThumbnail(
  projectId: string,
  firstClipPath: string
): Promise<string | null> {
  try {
    // First, probe the file to check if it has video
    const mediaInfo = await probe(firstClipPath);

    // If file has no video (audio-only), skip thumbnail generation
    if (mediaInfo.width === 0 || mediaInfo.height === 0) {
      console.log(
        `[ThumbService] Skipping thumbnail for audio-only file: ${firstClipPath}`
      );
      return null;
    }

    const thumbPath = getProjectThumbPath(projectId);

    await generateThumbnail(firstClipPath, thumbPath);
    console.log(`[ThumbService] Generated project thumbnail: ${thumbPath}`);

    // Update project metadata with thumbnail path
    const project = await loadProject(projectId);
    if (project) {
      project.previewThumbPath = thumbPath;
      await saveProject(project);
      console.log(`[ThumbService] Updated project with thumbnail path`);
    }

    return thumbPath;
  } catch (error) {
    console.error(
      `[ThumbService] Failed to generate thumbnail for project ${projectId}:`,
      error
    );
    // Don't throw - just return null to indicate no thumbnail
    return null;
  }
}

/**
 * Check if a project has a thumbnail
 */
export async function hasProjectThumbnail(projectId: string): Promise<boolean> {
  const thumbPath = getProjectThumbPath(projectId);

  try {
    await fs.access(thumbPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get project thumbnail path if it exists, null otherwise
 */
export async function getProjectThumbnailPath(
  projectId: string
): Promise<string | null> {
  const hasThumb = await hasProjectThumbnail(projectId);
  return hasThumb ? getProjectThumbPath(projectId) : null;
}
