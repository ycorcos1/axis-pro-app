/**
 * FFmpeg Service for Axis Pro
 * @mem ref: media-ffmpeg
 * Handles video probing and export operations using FFmpeg binary
 */

import { spawn } from "child_process";
import path from "path";
import { app } from "electron";
import type { MediaInfo, ExportOptions } from "../shared/types.js";

/**
 * Get the path to the bundled FFmpeg binary
 * Handles both development and production modes
 */
function getFFmpegPath(): string {
  // Map process.platform to directory names
  const platformDir = process.platform === "darwin" ? "mac" : process.platform;
  const binaryName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

  // In production, FFmpeg is bundled in extraResources
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "ffmpeg", platformDir, binaryName);
  }

  // In development, need to go up from dist/main/main to project root
  const appPath = app.getAppPath();

  // If we're in a dist folder (compiled), go up to project root
  if (appPath.includes("/dist/") || appPath.includes("\\dist\\")) {
    const separator = process.platform === "win32" ? "\\" : "/";
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

  // Otherwise use app path directly
  return path.join(appPath, "resources", "ffmpeg", platformDir, binaryName);
}

/**
 * Get the path to the bundled FFprobe binary
 * Handles both development and production modes
 */
function getFFprobePath(): string {
  // Map process.platform to directory names
  const platformDir = process.platform === "darwin" ? "mac" : process.platform;
  const binaryName = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";

  // In production, FFprobe is bundled in extraResources
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "ffmpeg", platformDir, binaryName);
  }

  // In development, need to go up from dist/main/main to project root
  const appPath = app.getAppPath();

  // If we're in a dist folder (compiled), go up to project root
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

  // Otherwise use app path directly
  return path.join(appPath, "resources", "ffmpeg", platformDir, binaryName);
}

/**
 * Probe a video file and return its metadata
 * Uses ffprobe to extract duration, dimensions, codec info, etc.
 *
 * @param filePath - Absolute path to the video file
 * @returns Promise<MediaInfo> - Media metadata
 */
export async function probe(filePath: string): Promise<MediaInfo> {
  const ffprobePath = getFFprobePath();

  console.log("[FFmpeg] Probing file:", filePath);
  console.log("[FFmpeg] Using ffprobe at:", ffprobePath);

  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      "-select_streams",
      "v:0", // First video stream only
      filePath,
    ];

    const ffprobeProcess = spawn(ffprobePath, args);

    let stdout = "";
    let stderr = "";

    ffprobeProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffprobeProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffprobeProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams?.[0];
        const format = data.format;

        if (!videoStream || !format) {
          reject(new Error("Invalid video file or no video stream found"));
          return;
        }

        // Parse fps (can be in format "30/1" or just "30")
        let fps = 30; // default
        if (videoStream.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split("/").map(Number);
          fps = den ? num / den : num;
        }

        const mediaInfo: MediaInfo = {
          path: filePath,
          duration: Math.floor(parseFloat(format.duration) * 1000), // Convert to ms
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          fps: Math.round(fps),
          codec: videoStream.codec_name || "unknown",
          bitrate: parseInt(format.bit_rate) || 0,
        };

        resolve(mediaInfo);
      } catch (error) {
        reject(new Error(`Failed to parse ffprobe output: ${error}`));
      }
    });

    ffprobeProcess.on("error", (error) => {
      reject(new Error(`Failed to spawn ffprobe: ${error.message}`));
    });
  });
}

/**
 * Export a trimmed segment of a video file
 * Uses FFmpeg with stream copy (-c copy) when possible for fast exports
 * Falls back to re-encode if necessary
 *
 * @param inputPath - Path to source video file
 * @param inMs - Start time in milliseconds
 * @param outMs - End time in milliseconds
 * @param outputPath - Path for output file
 * @param options - Optional export settings
 * @returns Promise<void>
 */
export async function trimExport(
  inputPath: string,
  inMs: number,
  outMs: number,
  outputPath: string,
  options?: ExportOptions
): Promise<void> {
  const ffmpegPath = getFFmpegPath();

  return new Promise((resolve, reject) => {
    // Convert milliseconds to seconds for FFmpeg
    const startTime = inMs / 1000;
    const duration = (outMs - inMs) / 1000;

    // Default to stream copy (fast) unless codec is specified
    const codec = options?.codec || "copy";

    const args = [
      "-ss",
      startTime.toString(), // Seek to start time
      "-i",
      inputPath, // Input file
      "-t",
      duration.toString(), // Duration
      "-c:v",
      codec, // Video codec
      "-c:a",
      "copy", // Audio codec (always copy for MVP)
    ];

    // Add quality settings if re-encoding
    if (codec !== "copy") {
      if (options?.preset) {
        args.push("-preset", options.preset);
      }
      if (options?.crf !== undefined) {
        args.push("-crf", options.crf.toString());
      }
    }

    // Add output path
    args.push("-y"); // Overwrite output file if exists
    args.push(outputPath);

    const ffmpegProcess = spawn(ffmpegPath, args);

    let stderr = "";

    // FFmpeg outputs progress info to stderr
    ffmpegProcess.stderr.on("data", (data) => {
      stderr += data.toString();
      // Could parse progress here for future progress bar
      console.log("[FFmpeg]", data.toString());
    });

    ffmpegProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed with code ${code}: ${stderr}`));
        return;
      }

      console.log("[FFmpeg] Export completed successfully");
      resolve();
    });

    ffmpegProcess.on("error", (error) => {
      reject(new Error(`Failed to spawn ffmpeg: ${error.message}`));
    });
  });
}

/**
 * Check if FFmpeg and FFprobe binaries are available
 * Useful for showing helpful error messages to users
 *
 * @returns Object with availability status
 */
export async function checkFFmpegAvailability(): Promise<{
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  ffmpegPath: string;
  ffprobePath: string;
}> {
  const fs = await import("fs/promises");
  const ffmpegPath = getFFmpegPath();
  const ffprobePath = getFFprobePath();

  let ffmpegAvailable = false;
  let ffprobeAvailable = false;

  try {
    await fs.access(ffmpegPath);
    ffmpegAvailable = true;
  } catch (error) {
    console.warn("[FFmpeg] ffmpeg binary not found at:", ffmpegPath);
  }

  try {
    await fs.access(ffprobePath);
    ffprobeAvailable = true;
  } catch (error) {
    console.warn("[FFmpeg] ffprobe binary not found at:", ffprobePath);
  }

  return {
    ffmpegAvailable,
    ffprobeAvailable,
    ffmpegPath,
    ffprobePath,
  };
}

/**
 * Remux a WebM file to MP4 format
 * Used after recording to convert MediaRecorder output to standard MP4
 * Uses stream copy when codecs are compatible, otherwise re-encodes
 *
 * @param inputPath - Path to source WebM file
 * @param outputPath - Path for output MP4 file
 * @returns Promise<void>
 */
export async function remuxWebMToMP4(
  inputPath: string,
  outputPath: string
): Promise<void> {
  const ffmpegPath = getFFmpegPath();

  console.log("[FFmpeg] Remuxing WebM to MP4");
  console.log("[FFmpeg] Input:", inputPath);
  console.log("[FFmpeg] Output:", outputPath);

  return new Promise((resolve, reject) => {
    // Try stream copy first for speed
    // If codecs are compatible (VP8/VP9 + Opus), this will work
    // Otherwise, FFmpeg will fail and we'll re-encode
    const args = [
      "-i",
      inputPath,
      "-c:v",
      "copy", // Try to copy video stream
      "-c:a",
      "aac", // Convert audio to AAC for MP4 compatibility
      "-b:a",
      "192k", // Audio bitrate
      "-movflags",
      "+faststart", // Optimize for streaming
      "-y", // Overwrite output file
      outputPath,
    ];

    console.log("[FFmpeg] Running:", ffmpegPath, args.join(" "));

    const ffmpegProcess = spawn(ffmpegPath, args);

    let stderr = "";

    ffmpegProcess.stderr.on("data", (data) => {
      stderr += data.toString();
      console.log("[FFmpeg]", data.toString().trim());
    });

    ffmpegProcess.on("close", (code) => {
      if (code !== 0) {
        // Stream copy failed, try re-encoding
        console.log("[FFmpeg] Stream copy failed, re-encoding...");
        remuxWebMToMP4WithReencode(inputPath, outputPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      console.log("[FFmpeg] Remux completed successfully");
      resolve();
    });

    ffmpegProcess.on("error", (error) => {
      reject(new Error(`Failed to spawn ffmpeg: ${error.message}`));
    });
  });
}

/**
 * Remux WebM to MP4 with re-encoding
 * Fallback when stream copy is not compatible
 *
 * @param inputPath - Path to source WebM file
 * @param outputPath - Path for output MP4 file
 * @returns Promise<void>
 */
async function remuxWebMToMP4WithReencode(
  inputPath: string,
  outputPath: string
): Promise<void> {
  const ffmpegPath = getFFmpegPath();

  return new Promise((resolve, reject) => {
    const args = [
      "-i",
      inputPath,
      "-c:v",
      "libx264", // Re-encode to H.264
      "-preset",
      "fast",
      "-crf",
      "23", // Good quality
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      "-y",
      outputPath,
    ];

    console.log("[FFmpeg] Re-encoding:", ffmpegPath, args.join(" "));

    const ffmpegProcess = spawn(ffmpegPath, args);

    let stderr = "";

    ffmpegProcess.stderr.on("data", (data) => {
      stderr += data.toString();
      console.log("[FFmpeg]", data.toString().trim());
    });

    ffmpegProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg re-encode failed with code ${code}: ${stderr}`));
        return;
      }

      console.log("[FFmpeg] Re-encode completed successfully");
      resolve();
    });

    ffmpegProcess.on("error", (error) => {
      reject(new Error(`Failed to spawn ffmpeg: ${error.message}`));
    });
  });
}
