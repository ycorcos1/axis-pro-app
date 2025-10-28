/**
 * Recording Service for Axis Pro
 * @mem ref: pr13-recording-suite
 * Handles screen/window capture with optional webcam and microphone
 * Uses Electron desktopCapturer for screen sources
 * Renderer process handles MediaRecorder for actual capture
 */

import { desktopCapturer } from "electron";
import type { DesktopSource } from "../shared/types.js";

/**
 * Get available desktop capture sources (screens and windows)
 * Returns sources with thumbnails for UI selection
 *
 * @returns Promise<DesktopSource[]> - List of available sources
 */
export async function getDesktopSources(): Promise<DesktopSource[]> {
  try {
    console.log("[Recording] Fetching desktop sources...");

    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: false,
    });

    console.log(`[Recording] Found ${sources.length} sources`);

    const desktopSources: DesktopSource[] = sources.map((source) => ({
      id: source.id,
      name: source.name,
      type: source.id.startsWith("screen:") ? "screen" : "window",
      thumbnail: source.thumbnail.toDataURL(),
    }));

    return desktopSources;
  } catch (error) {
    console.error("[Recording] Failed to get desktop sources:", error);
    throw error;
  }
}

/**
 * Note: Actual recording is handled in the renderer process using MediaRecorder
 * This service only provides desktop source enumeration for the main process
 *
 * Recording flow:
 * 1. Main process lists sources via desktopCapturer.getSources()
 * 2. Renderer receives source list and user selects one
 * 3. Renderer uses navigator.mediaDevices.getUserMedia() with chromeMediaSourceId constraint
 * 4. Renderer combines streams (screen + webcam + mic) and uses MediaRecorder
 * 5. Renderer saves chunks to file via IPC
 * 6. On stop, renderer notifies main to remux WebM → MP4 via FFmpeg
 */

