/**
 * AI Shorts Service for Axis Pro
 * @mem ref: pr17-ai-shorts
 * Handles AI-powered short video generation using OpenAI Whisper & GPT
 * Complete workflow: Upload → Transcribe → Segment → Render → Export
 */

import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { app } from "electron";
import { getOpenAI, isOpenAIReady } from "./aiService.js";
import type {
  AIShort,
  AIShortsJobProgress,
  AIShortsResult,
  HighlightSegment,
  TranscriptSegment,
  WordTimestamp,
} from "../shared/types.js";

/**
 * Get FFmpeg path (same logic as ffmpegService)
 */
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
 * Progress callback type
 */
type ProgressCallback = (progress: AIShortsJobProgress) => void;

/**
 * Extract audio from video for Whisper transcription
 * Optimized for faster processing: lower bitrate, 16kHz mono
 * @param videoPath - Input video file path
 * @param audioPath - Output audio file path (16kHz mono WAV)
 */
async function extractAudio(
  videoPath: string,
  audioPath: string
): Promise<void> {
  console.log("[AI Shorts] Extracting audio from video...");

  const ffmpegPath = getFFmpegPath();

  return new Promise((resolve, reject) => {
    const args = [
      "-y", // overwrite output
      "-i",
      videoPath,
      "-vn", // no video
      "-ar",
      "16000", // 16kHz sample rate (Whisper requirement)
      "-ac",
      "1", // mono
      "-b:a",
      "32k", // Lower bitrate for faster processing and smaller file
      "-acodec",
      "libmp3lame", // Use MP3 instead of WAV for much smaller file size
      audioPath.replace(".wav", ".mp3"), // Change extension to mp3
    ];

    const ffmpeg = spawn(ffmpegPath, args);

    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg audio extraction failed: ${stderr}`));
        return;
      }
      console.log("[AI Shorts] Audio extracted successfully");
      resolve();
    });

    ffmpeg.on("error", (error) => {
      reject(new Error(`Failed to spawn FFmpeg: ${error.message}`));
    });
  });
}

/**
 * Transcribe audio using OpenAI Whisper
 * @param audioPath - Path to audio file (16kHz mono MP3)
 * @returns Transcript with word-level and segment timestamps
 */
async function transcribeAudio(audioPath: string): Promise<{
  text: string;
  segments?: TranscriptSegment[];
  words?: WordTimestamp[];
}> {
  console.log("[AI Shorts] Transcribing audio with Whisper...");

  if (!isOpenAIReady()) {
    throw new Error("OpenAI client not initialized");
  }

  const openai = getOpenAI();

  try {
    // Check file size (Whisper has a 25MB limit)
    const stats = await fs.stat(audioPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    console.log(`[AI Shorts] Audio file size: ${fileSizeMB.toFixed(2)} MB`);

    if (fileSizeMB > 25) {
      throw new Error(
        "Audio file is too large for Whisper API (max 25MB). Try a shorter video."
      );
    }

    // Read audio file and create a proper File-like object
    const audioBuffer = await fs.readFile(audioPath);

    // Create a File-like object that OpenAI SDK accepts
    // Whisper accepts MP3, so we'll use that MIME type
    const audioFile = new File([audioBuffer], "audio.mp3", {
      type: "audio/mpeg",
    });

    // Call Whisper API with word-level timestamps
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "verbose_json", // Get timestamps
      timestamp_granularities: ["word", "segment"], // Request both word and segment level
      language: "en", // Optional: can be removed for auto-detect
    });

    console.log("[AI Shorts] Transcription complete");
    console.log(`[AI Shorts] Transcript length: ${transcription.text.length}`);

    // Extract segments if available
    const segments: TranscriptSegment[] = [];
    if (transcription.segments) {
      for (const seg of transcription.segments) {
        segments.push({
          text: seg.text || "",
          start: seg.start || 0,
          end: seg.end || 0,
        });
      }
    }

    // Extract word-level timestamps if available
    const words: WordTimestamp[] = [];
    if (transcription.words) {
      for (const word of transcription.words) {
        words.push({
          text: word.word || "",
          start: word.start || 0,
          end: word.end || 0,
        });
      }
      console.log(
        `[AI Shorts] Extracted ${words.length} word-level timestamps`
      );
    }

    return {
      text: transcription.text,
      segments: segments.length > 0 ? segments : undefined,
      words: words.length > 0 ? words : undefined,
    };
  } catch (error: any) {
    console.error("[AI Shorts] Transcription error:", error);

    // Provide more helpful error messages
    if (error.message?.includes("Unrecognized file format")) {
      throw new Error(
        "Audio format error. Please ensure FFmpeg extracted the audio correctly."
      );
    }

    throw new Error(`Whisper transcription failed: ${error.message}`);
  }
}

/**
 * Analyze transcript and extract highlight segments using GPT
 * @param transcriptText - Full transcript text
 * @param videoDurationMs - Total video duration in milliseconds
 * @param existingSegments - Optional array of existing segments to avoid duplication
 * @param numShorts - Number of shorts to generate (1-10)
 * @returns Array of highlight segments with captions
 */
async function analyzeHighlights(
  transcriptText: string,
  videoDurationMs: number,
  existingSegments?: HighlightSegment[],
  numShorts: number = 5
): Promise<HighlightSegment[]> {
  console.log("[AI Shorts] Analyzing highlights with GPT...");
  console.log(`[AI Shorts] Requesting ${numShorts} shorts`);

  if (!isOpenAIReady()) {
    throw new Error("OpenAI client not initialized");
  }

  const openai = getOpenAI();

  const videoDurationSec = Math.floor(videoDurationMs / 1000);

  // Build context about existing segments
  let existingContext = "";
  if (existingSegments && existingSegments.length > 0) {
    existingContext = `\n\nIMPORTANT - Previously used segments (avoid exact duplicates, but some overlap is OK):
${existingSegments
  .map(
    (seg, i) =>
      `${i + 1}. ${Math.floor(seg.startMs / 1000)}s-${Math.floor(
        seg.endMs / 1000
      )}s: "${seg.caption}"`
  )
  .join("\n")}

Find NEW highlight segments that cover different topics/angles. Some timing overlap is acceptable if the content focus is different.`;
  }

  const prompt = `You are an expert video editor specializing in viral short-form content (TikTok, Instagram Reels, YouTube Shorts).

Video duration: ${videoDurationSec} seconds

Full Transcript:
"""
${transcriptText}
"""
${existingContext}

Task: Identify EXACTLY ${numShorts} compelling segments that would perform well as standalone shorts.

SELECTION CRITERIA (in priority order):
1. **Hook Value**: Strong opening that grabs attention in first 3 seconds
2. **Complete Narrative**: Has clear beginning, middle, end
3. **Emotional Impact**: Surprises, teaches, entertains, or inspires
4. **Standalone Quality**: Makes sense without full context
5. **Retention**: Keeps viewers watching to the end
6. **Shareability**: Content people would want to share

DURATION STRATEGY (CRITICAL - MUST VARY):
- 30-45s: Quick tips, punchlines, shocking facts → HIGH retention potential
- 45-75s: Stories, explanations, tutorials → BALANCED engagement  
- 75-120s: Deep dives, case studies, detailed stories → LOYAL audience
- 120-180s: In-depth explanations, complete narratives → DEDICATED viewers
- **IMPORTANT**: DO NOT make all clips the same length! Mix short (30-60s), medium (60-120s), and long (120-180s) clips
- Match duration to content depth - don't artificially extend or cut short good content

CONTENT PREFERENCES:
✅ Strong emotional hooks (curiosity, surprise, controversy)
✅ Actionable advice or insights
✅ Relatable stories or examples
✅ Clear value proposition in first 5 seconds
❌ Slow intros or setup without payoff
❌ Inside jokes requiring full context
❌ Rambling without clear point
❌ Technical jargon without explanation

For each segment:
1. Start time (seconds) - ideally at a natural speaking pause or topic shift
2. End time (seconds) - cut before trailing off or transitioning away
3. Compelling title (8-12 words, use curiosity/value/emotion)
4. Hook score (1-10): How attention-grabbing is the opening?
5. Retention score (1-10): How likely to watch until end?
6. Reasoning: Why this will perform well

Return EXACTLY ${numShorts} segments in JSON:
{
  "segments": [
    {
      "startSec": 15,
      "endSec": 58,
      "caption": "Why 90% of creators fail at this one thing",
      "hookScore": 9,
      "retentionScore": 8,
      "reasoning": "Opens with shocking statistic, delivers quick actionable solution, clear value in first 3 seconds"
    }
  ]
}

CRITICAL RULES:
- NO overlapping segments
- ALL segments must be within 0-${videoDurationSec}s
- **MUST VARY lengths** - aim for mix: some 30-60s, some 60-120s, some 120-180s
- DO NOT default to ~60 second clips - be intentional about duration
- Prioritize hook + retention scores over duration
- Each segment should work as a standalone piece
- Return EXACTLY ${numShorts} segments`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.9, // Increased from 0.7 to encourage more creative variation in segment selection
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from GPT");
    }

    const result = JSON.parse(content);

    if (!result.segments || !Array.isArray(result.segments)) {
      throw new Error("Invalid GPT response format");
    }

    // Convert to HighlightSegment format with validation
    const highlights: HighlightSegment[] = result.segments.map(
      (seg: any, index: number) => {
        let startMs = Math.max(0, Math.floor(seg.startSec * 1000));
        let endMs = Math.min(videoDurationMs, Math.floor(seg.endSec * 1000));

        // Ensure minimum 30s and maximum 180s (3 minutes)
        const durationMs = endMs - startMs;
        if (durationMs < 30000) {
          // Less than 30 seconds - extend to 30s
          endMs = Math.min(videoDurationMs, startMs + 30000);
        }
        if (durationMs > 180000) {
          // More than 3 minutes - cap at 180s
          endMs = startMs + 180000;
        }

        return {
          startMs,
          endMs,
          caption: seg.caption || `Highlight ${index + 1}`,
          reasoning: seg.reasoning,
          hookScore: seg.hookScore || 5,
          retentionScore: seg.retentionScore || 5,
        };
      }
    );

    console.log(`[AI Shorts] Found ${highlights.length} highlight segments`);

    // Log quality metrics
    highlights.forEach((h, i) => {
      const durationSec = (h.endMs - h.startMs) / 1000;
      console.log(
        `[AI Shorts] Segment ${i + 1}: ${durationSec.toFixed(1)}s | Hook: ${
          h.hookScore
        }/10 | Retention: ${h.retentionScore}/10 | ${h.caption}`
      );
    });

    return highlights;
  } catch (error: any) {
    console.error("[AI Shorts] GPT analysis error:", error);
    throw new Error(`GPT analysis failed: ${error.message}`);
  }
}

/**
 * Extract transcript text for a specific time segment
 */
function extractSegmentTranscript(
  segments: TranscriptSegment[],
  startMs: number,
  endMs: number
): string {
  const startSec = startMs / 1000;
  const endSec = endMs / 1000;

  const relevantSegments = segments.filter(
    (seg) => seg.start >= startSec && seg.end <= endSec
  );

  return relevantSegments
    .map((seg) => seg.text)
    .join(" ")
    .trim();
}

/**
 * Extract word timestamps for a specific time segment
 * Used to create accurate word-level subtitles for shorts
 */
function extractSegmentWords(
  words: WordTimestamp[],
  startMs: number,
  endMs: number
): WordTimestamp[] {
  const startSec = startMs / 1000;
  const endSec = endMs / 1000;

  return words.filter((word) => word.start >= startSec && word.end <= endSec);
}

/**
 * Split text into max 2 lines, breaking at natural points
 * Tries to balance line lengths and respect word boundaries
 */
function formatIntoLines(text: string, maxCharsPerLine: number): string {
  if (text.length <= maxCharsPerLine) {
    return text;
  }

  const words = text.split(" ");
  if (words.length === 1) {
    return text; // Single long word, can't split
  }

  // Find best split point (closest to middle while respecting max length)
  let line1 = "";
  let line2 = "";
  const targetLength = text.length / 2;

  for (let i = 0; i < words.length; i++) {
    const testLine = line1 + (line1 ? " " : "") + words[i];

    // Check if adding this word would exceed max length
    if (testLine.length > maxCharsPerLine && line1.length > 0) {
      // Start second line with remaining words
      line2 = words.slice(i).join(" ");
      break;
    }

    // Check if this is closer to balanced split
    if (
      testLine.length <= maxCharsPerLine &&
      Math.abs(testLine.length - targetLength) <
        Math.abs(line1.length - targetLength)
    ) {
      line1 = testLine;
    } else if (line1.length > 0) {
      line2 = words.slice(i).join(" ");
      break;
    } else {
      line1 = testLine;
    }
  }

  // If line2 is too long, just return what we have
  if (line2.length > maxCharsPerLine * 1.2) {
    // Allow 20% overflow on second line
    return line1;
  }

  return line2 ? `${line1}\n${line2}` : line1;
}

/**
 * Create SRT subtitle file from word-level timestamps
 * Groups 2-6 words together for optimal readability while maintaining accurate timing
 * Formats into max 2 lines per subtitle entry
 */
function createSRTFromWords(
  words: WordTimestamp[],
  segmentStartSec: number,
  outputPath: string
): Promise<void> {
  let srtContent = "";
  let subtitleIndex = 1;

  const MAX_CHARS_PER_LINE = 30; // Reduced from 35 to encourage 2-line splits
  const MAX_WORDS_PER_GROUP = 8; // Increased from 6 to allow more words with smaller font
  const MAX_LINES = 2;

  let currentGroup: WordTimestamp[] = [];
  let currentLength = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordLength = word.text.length;
    currentGroup.push(word);
    currentLength += wordLength + 1; // +1 for space

    const nextWord = i < words.length - 1 ? words[i + 1] : null;
    const timingGap = nextWord ? nextWord.start - word.end : 0;

    // Break conditions for creating a subtitle entry
    const shouldBreak =
      !nextWord || // last word
      currentGroup.length >= MAX_WORDS_PER_GROUP ||
      currentLength >= MAX_CHARS_PER_LINE * MAX_LINES ||
      timingGap > 0.6; // pause > 600ms indicates natural break

    if (shouldBreak && currentGroup.length > 0) {
      // Format as 1 or 2 lines
      const groupText = currentGroup.map((w) => w.text.trim()).join(" ");
      const lines = formatIntoLines(groupText, MAX_CHARS_PER_LINE);

      // Calculate timing relative to segment start
      const startMs = Math.floor(
        (currentGroup[0].start - segmentStartSec) * 1000
      );
      const endMs = Math.floor(
        (currentGroup[currentGroup.length - 1].end - segmentStartSec) * 1000
      );

      // Only add if timing is valid (within segment)
      if (startMs >= 0 && endMs > startMs) {
        const startTime = formatSRTTime(startMs);
        const endTime = formatSRTTime(endMs);

        srtContent += `${subtitleIndex}\n`;
        srtContent += `${startTime} --> ${endTime}\n`;
        srtContent += `${lines.toUpperCase()}\n\n`; // Uppercase for social media style
        subtitleIndex++;
      }

      // Reset for next group
      currentGroup = [];
      currentLength = 0;
    }
  }

  return fs.writeFile(outputPath, srtContent, "utf-8");
}

/**
 * Generate captions for a segment using GPT
 * Refines and formats captions for readability
 */
async function generateCaptions(
  segmentText: string,
  caption: string
): Promise<string[]> {
  console.log("[AI Shorts] Generating refined captions...");

  if (!isOpenAIReady()) {
    // Fallback: split caption into chunks
    return [caption];
  }

  const openai = getOpenAI();

  // Estimate duration based on word count (average speaking rate: 2.5 words/sec)
  const wordCount = segmentText.split(" ").length;
  const durationSec = Math.floor(wordCount / 2.5);

  const prompt = `You are creating on-screen captions for a ${durationSec}-second vertical video.

Video title: "${caption}"

Spoken transcript:
"""
${segmentText}
"""

Task: Create captions that appear sequentially during the video. Follow these rules:
- Create ONE caption per 3-5 seconds of speech
- Max 5 words per caption
- Match the natural flow of speech
- Make them punchy and engaging
- Use simple, readable words
- Total captions should roughly match the ${durationSec}-second duration

Respond in JSON format:
{
  "captions": ["Caption 1", "Caption 2", "Caption 3", ...]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return [caption];
    }

    const result = JSON.parse(content);
    if (result.captions && Array.isArray(result.captions)) {
      return result.captions;
    }

    return [caption];
  } catch (error) {
    console.error("[AI Shorts] Caption generation error:", error);
    return [caption]; // Fallback
  }
}

/**
 * Create SRT subtitle file from captions with multi-word timing
 * Creates animated captions with 2-5 words appearing at a time for better readability
 * Respects natural phrases and punctuation breaks
 */
function createSRTFile(
  captions: string[],
  durationMs: number,
  outputPath: string
): Promise<void> {
  const timePerCaption = durationMs / captions.length;
  let srtContent = "";
  let subtitleIndex = 1;

  captions.forEach((caption, captionIndex) => {
    const captionStartMs = Math.floor(captionIndex * timePerCaption);
    const captionEndMs = Math.floor((captionIndex + 1) * timePerCaption);

    // Split caption into words
    const words = caption.split(" ");

    // Group words into chunks of 2-4 words, respecting punctuation and natural phrases
    const wordChunks: string[] = [];
    let currentChunk: string[] = [];

    for (let i = 0; i < words.length; i++) {
      currentChunk.push(words[i]);

      // Break at punctuation or every 3-4 words
      const hasComma = words[i].includes(",");
      const hasPeriod = words[i].includes(".");
      const hasBreak = currentChunk.length >= 3;
      const isLast = i === words.length - 1;

      if (hasComma || hasPeriod || hasBreak || isLast) {
        // Remove punctuation and add to chunks
        const chunkText = currentChunk.join(" ").replace(/[,\.]/g, "");
        if (chunkText.trim()) {
          wordChunks.push(chunkText);
        }
        currentChunk = [];
      }
    }

    // Ensure we have at least one chunk
    if (wordChunks.length === 0) {
      wordChunks.push(caption.replace(/[,\.]/g, ""));
    }

    const timePerChunk = (captionEndMs - captionStartMs) / wordChunks.length;

    wordChunks.forEach((chunk, chunkIndex) => {
      const startMs = Math.floor(captionStartMs + chunkIndex * timePerChunk);
      const endMs = Math.floor(
        captionStartMs + (chunkIndex + 1) * timePerChunk
      );

      const startTime = formatSRTTime(startMs);
      const endTime = formatSRTTime(endMs);

      srtContent += `${subtitleIndex}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${chunk.toUpperCase()}\n\n`; // Uppercase for social media style

      subtitleIndex++;
    });
  });

  return fs.writeFile(outputPath, srtContent, "utf-8");
}

/**
 * Format milliseconds to SRT time format (HH:MM:SS,mmm)
 */
function formatSRTTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

/**
 * Caption styling configuration
 * Allows easy customization of on-screen caption appearance
 */
interface CaptionStyle {
  fontSize: number; // Font size in pixels
  fontName: string; // Font family name
  alignment: number; // 2=bottom, 5=middle, 8=top (centered horizontally)
  primaryColor: string; // Text color in AABBGGRR format
  outlineColor: string; // Outline color in AABBGGRR format
  backgroundColor: string; // Background box color in AABBGGRR format
  outline: number; // Outline thickness
  marginV: number; // Vertical margin
  marginL: number; // Left margin
  marginR: number; // Right margin
}

/**
 * Improved caption style for social media shorts
 * Optimized for maximum readability and professional appearance
 * Designed to encourage 2-line captions at bottom center
 */
const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSize: 16, // Reduced to encourage 2-line formatting
  fontName: "Montserrat-Bold", // Modern, clean font (falls back to Impact)
  alignment: 2, // Bottom center (like TikTok/Instagram Reels)
  primaryColor: "&H00FFFF&", // Yellow (high contrast, attention-grabbing)
  outlineColor: "&H000000&", // Black outline for better legibility
  backgroundColor: "&H80000000&", // Semi-transparent black (50% opacity)
  outline: 3, // Thicker outline for better edge definition
  marginV: 30, // Lower value = closer to bottom edge
  marginL: 30, // Left margin for padding
  marginR: 30, // Right margin for padding
};

/**
 * Render a short video with portrait orientation and burned-in captions
 * Uses social media style captions (large, bold, centered, animated word-by-word)
 * @param videoPath - Source video path
 * @param startMs - Start time in milliseconds
 * @param endMs - End time in milliseconds
 * @param srtPath - Path to SRT subtitle file
 * @param outputPath - Output video path
 * @param captionStyle - Optional custom caption styling
 */
async function renderShort(
  videoPath: string,
  startMs: number,
  endMs: number,
  srtPath: string,
  outputPath: string,
  captionStyle: CaptionStyle = DEFAULT_CAPTION_STYLE
): Promise<void> {
  console.log("[AI Shorts] Rendering short video...");

  const ffmpegPath = getFFmpegPath();
  const startSec = startMs / 1000;
  const durationSec = (endMs - startMs) / 1000;

  return new Promise((resolve, reject) => {
    // Build subtitle style string from configuration
    const subtitleStyle = [
      `Alignment=${captionStyle.alignment}`,
      `FontSize=${captionStyle.fontSize}`,
      `FontName=${captionStyle.fontName}`,
      "Bold=1",
      `PrimaryColour=${captionStyle.primaryColor}`,
      "SecondaryColour=&HFFFFFF&",
      `OutlineColour=${captionStyle.outlineColor}`,
      `BackColour=${captionStyle.backgroundColor}`,
      "BorderStyle=4", // Background box
      `Outline=${captionStyle.outline}`,
      "Shadow=0",
      `MarginV=${captionStyle.marginV}`,
      `MarginL=${captionStyle.marginL}`,
      `MarginR=${captionStyle.marginR}`,
    ].join(",");

    // Professional portrait conversion with blurred background fill
    // This ensures no content is cut off and looks great on social media
    const vf = [
      // Split input into two streams: background and foreground
      "[0:v]split=2[bg][fg]",
      // Background: Scale to fill, crop to exact size, and blur heavily
      "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=20[blurred]",
      // Foreground: Scale to fit (maintain full content, no cropping)
      "[fg]scale=1080:1920:force_original_aspect_ratio=decrease[scaled]",
      // Overlay scaled content on top of blurred background (centered)
      "[blurred][scaled]overlay=(W-w)/2:(H-h)/2[video]",
      // Add subtitles on top of the composite
      `[video]subtitles='${srtPath
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:")}':force_style='${subtitleStyle}'`,
    ].join(";");

    const args = [
      "-y", // overwrite
      "-ss",
      String(startSec),
      "-t",
      String(durationSec),
      "-i",
      videoPath,
      "-vf",
      vf,

      // IMPROVED VIDEO ENCODING
      "-c:v",
      "libx264",
      "-preset",
      "slow", // Changed from "medium" - better quality at cost of encoding time
      "-crf",
      "20", // Changed from 23 - lower = higher quality (18-22 recommended for high quality)
      "-profile:v",
      "high", // H.264 high profile for better compression
      "-level",
      "4.2", // Compatibility level for modern devices
      "-pix_fmt",
      "yuv420p", // Ensures compatibility with all players

      // IMPROVED AUDIO ENCODING WITH NORMALIZATION
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11", // Normalize loudness to broadcast standard
      "-c:a",
      "aac",
      "-b:a",
      "192k", // Increased from 128k for better audio quality
      "-ar",
      "48000",

      // OPTIMIZATION
      "-movflags",
      "+faststart", // Enables streaming/fast loading (moves moov atom to start)

      outputPath,
    ];

    const ffmpeg = spawn(ffmpegPath, args);

    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg rendering failed: ${stderr}`));
        return;
      }
      console.log("[AI Shorts] Rendering complete");
      resolve();
    });

    ffmpeg.on("error", (error) => {
      reject(new Error(`Failed to spawn FFmpeg: ${error.message}`));
    });
  });
}

/**
 * Generate high-quality thumbnail for a short video
 * Captures frame at 2 seconds with enhanced quality settings
 */
async function generateThumbnail(
  videoPath: string,
  thumbnailPath: string
): Promise<void> {
  const ffmpegPath = getFFmpegPath();

  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      videoPath,
      "-ss",
      "00:00:02", // 2 seconds in (avoid fade-in/black frames)
      "-vframes",
      "1",
      "-vf",
      [
        "scale=405:720", // Higher quality thumbnail (3x increase from 360:640)
        "unsharp=5:5:0.8:3:3:0.4", // Sharpen slightly for better preview
      ].join(","),
      "-q:v",
      "2", // High quality JPEG (1-31 scale, lower=better, 2-5 is excellent)
      thumbnailPath,
    ];

    const ffmpeg = spawn(ffmpegPath, args);

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("Thumbnail generation failed"));
        return;
      }
      resolve();
    });

    ffmpeg.on("error", reject);
  });
}

/**
 * Main function: Generate AI shorts from a video
 * @param videoPath - Input video file path
 * @param projectId - Project ID for organizing outputs
 * @param onProgress - Progress callback
 * @param numShorts - Number of shorts to generate (1-10, default 5)
 * @returns Array of generated shorts
 */
export async function generateAIShorts(
  videoPath: string,
  projectId: string,
  onProgress?: ProgressCallback,
  numShorts: number = 5
): Promise<AIShortsResult> {
  console.log("[AI Shorts] Starting generation process...");
  console.log("[AI Shorts] Video:", videoPath);
  console.log("[AI Shorts] Project:", projectId);

  try {
    if (!isOpenAIReady()) {
      throw new Error(
        "OpenAI API not available. Please add OPENAI_API_KEY to your .env file."
      );
    }

    // Create shorts directory
    const homeDir = app.getPath("home");
    const projectPath = path.join(homeDir, "AxisPro", "projects", projectId);
    const shortsDir = path.join(projectPath, "shorts");
    await fs.mkdir(shortsDir, { recursive: true });

    // Create temp directory for audio
    const tempDir = path.join(shortsDir, "temp");
    await fs.mkdir(tempDir, { recursive: true });

    // Step 1: Extract audio
    onProgress?.({
      status: "transcribing",
      message: "Extracting audio...",
      progress: 10,
    });

    const audioPath = path.join(tempDir, "audio.mp3"); // Changed to MP3
    await extractAudio(videoPath, audioPath);

    // Step 2: Transcribe with Whisper
    onProgress?.({
      status: "transcribing",
      message: "Transcribing with Whisper AI...",
      progress: 30,
    });

    const transcript = await transcribeAudio(audioPath);

    // Save transcript
    const transcriptPath = path.join(shortsDir, "transcript.json");
    await fs.writeFile(transcriptPath, JSON.stringify(transcript, null, 2));

    // Step 3: Analyze with GPT
    onProgress?.({
      status: "segmenting",
      message: "Analyzing highlights with GPT...",
      progress: 50,
    });

    // Get video duration (rough estimate from file size, or probe it)
    const { probe } = await import("./ffmpegService.js");
    const mediaInfo = await probe(videoPath);
    const videoDurationMs = mediaInfo.duration;

    const highlights = await analyzeHighlights(
      transcript.text,
      videoDurationMs,
      undefined, // No existing segments for initial generation
      numShorts
    );

    if (highlights.length === 0) {
      throw new Error("No highlights found in video");
    }

    // Step 4: Render shorts
    const shorts: AIShort[] = [];
    const totalShorts = highlights.length;

    for (let i = 0; i < highlights.length; i++) {
      const highlight = highlights[i];
      const shortId = `short-${i + 1}`;
      const shortDir = path.join(shortsDir, shortId);
      await fs.mkdir(shortDir, { recursive: true });

      onProgress?.({
        status: "rendering",
        message: `Rendering short ${i + 1} of ${totalShorts}...`,
        progress: 50 + (i / totalShorts) * 40,
        currentShort: i + 1,
        totalShorts,
      });

      // Create SRT file with word-level timing if available
      const srtPath = path.join(shortDir, `${shortId}.srt`);

      if (transcript.words && transcript.words.length > 0) {
        // USE WORD-LEVEL TIMESTAMPS for accurate, synced subtitles
        const segmentWords = extractSegmentWords(
          transcript.words,
          highlight.startMs,
          highlight.endMs
        );

        if (segmentWords.length > 0) {
          console.log(
            `[AI Shorts] Using ${segmentWords.length} word timestamps for accurate subtitles`
          );
          await createSRTFromWords(
            segmentWords,
            highlight.startMs / 1000, // Convert to seconds for offset
            srtPath
          );
        } else {
          // Fallback if no words in this segment
          console.warn(
            "[AI Shorts] No word timestamps found for segment, using fallback"
          );
          const segmentTranscript = extractSegmentTranscript(
            transcript.segments || [],
            highlight.startMs,
            highlight.endMs
          );
          const captionText =
            segmentTranscript.length > 0 ? segmentTranscript : transcript.text;
          const captions = await generateCaptions(
            captionText,
            highlight.caption
          );
          await createSRTFile(
            captions,
            highlight.endMs - highlight.startMs,
            srtPath
          );
        }
      } else {
        // Fallback to old method if Whisper didn't provide word timestamps
        console.warn(
          "[AI Shorts] No word-level timestamps available, using fallback method"
        );
        const segmentTranscript = extractSegmentTranscript(
          transcript.segments || [],
          highlight.startMs,
          highlight.endMs
        );
        const captionText =
          segmentTranscript.length > 0 ? segmentTranscript : transcript.text;
        const captions = await generateCaptions(captionText, highlight.caption);
        await createSRTFile(
          captions,
          highlight.endMs - highlight.startMs,
          srtPath
        );
      }

      // Render video
      const videoOutputPath = path.join(shortDir, `${shortId}.mp4`);
      await renderShort(
        videoPath,
        highlight.startMs,
        highlight.endMs,
        srtPath,
        videoOutputPath
      );

      // Generate thumbnail
      const thumbnailPath = path.join(shortDir, `${shortId}-thumb.jpg`);
      await generateThumbnail(videoOutputPath, thumbnailPath);

      // Save metadata
      const jsonPath = path.join(shortDir, `${shortId}.json`);
      const metadata = {
        id: shortId,
        projectId,
        startMs: highlight.startMs,
        endMs: highlight.endMs,
        durationMs: highlight.endMs - highlight.startMs,
        caption: highlight.caption,
        reasoning: highlight.reasoning,
        hookScore: highlight.hookScore,
        retentionScore: highlight.retentionScore,
        useWordLevelTiming: !!(transcript.words && transcript.words.length > 0),
        createdAt: Date.now(),
      };
      await fs.writeFile(jsonPath, JSON.stringify(metadata, null, 2));

      shorts.push({
        id: shortId,
        projectId,
        startMs: highlight.startMs,
        endMs: highlight.endMs,
        durationMs: highlight.endMs - highlight.startMs,
        caption: highlight.caption,
        videoPath: videoOutputPath,
        srtPath,
        jsonPath,
        thumbnailPath,
        createdAt: Date.now(),
      });
    }

    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    onProgress?.({
      status: "complete",
      message: `Generated ${shorts.length} shorts successfully!`,
      progress: 100,
      totalShorts: shorts.length,
    });

    console.log(`[AI Shorts] Generation complete: ${shorts.length} shorts`);

    return {
      success: true,
      shorts,
    };
  } catch (error: any) {
    console.error("[AI Shorts] Generation failed:", error);

    onProgress?.({
      status: "error",
      message: error.message || "Unknown error",
      progress: 0,
    });

    return {
      success: false,
      shorts: [],
      error: error.message,
    };
  }
}

/**
 * Check if AI Shorts feature is available
 */
export function isAIShortsAvailable(): boolean {
  return isOpenAIReady();
}

/**
 * Load existing AI shorts from a project directory
 * @param projectId - Project ID to load shorts from
 * @returns Array of existing shorts
 */
export async function loadExistingShorts(
  projectId: string
): Promise<AIShort[]> {
  console.log("[AI Shorts] Loading existing shorts for project:", projectId);

  try {
    // Use home directory instead of userData for consistency
    const homeDir = app.getPath("home");
    const projectPath = path.join(homeDir, "AxisPro", "projects", projectId);
    const shortsDir = path.join(projectPath, "shorts");

    console.log("[AI Shorts] Looking for shorts in:", shortsDir);

    // Check if shorts directory exists
    try {
      await fs.access(shortsDir);
    } catch {
      console.log("[AI Shorts] No shorts directory found");
      return [];
    }

    // Read all subdirectories (short-1, short-2, etc.)
    const entries = await fs.readdir(shortsDir, { withFileTypes: true });
    const shortDirs = entries.filter(
      (entry) => entry.isDirectory() && entry.name.startsWith("short-")
    );

    const shorts: AIShort[] = [];

    for (const dir of shortDirs) {
      const shortDir = path.join(shortsDir, dir.name);
      const jsonPath = path.join(shortDir, `${dir.name}.json`);

      try {
        // Read metadata JSON
        const metadataContent = await fs.readFile(jsonPath, "utf-8");
        const metadata = JSON.parse(metadataContent);

        // Construct full paths
        const videoPath = path.join(shortDir, `${dir.name}.mp4`);
        const srtPath = path.join(shortDir, `${dir.name}.srt`);
        const thumbnailPath = path.join(shortDir, `${dir.name}-thumb.jpg`);

        // Check if files exist
        const videoExists = await fs
          .access(videoPath)
          .then(() => true)
          .catch(() => false);

        if (videoExists) {
          shorts.push({
            id: metadata.id || dir.name,
            projectId,
            startMs: metadata.startMs,
            endMs: metadata.endMs,
            durationMs: metadata.durationMs,
            caption: metadata.caption,
            videoPath,
            srtPath,
            jsonPath,
            thumbnailPath,
            createdAt: metadata.createdAt,
          });
        }
      } catch (error) {
        console.error(`[AI Shorts] Failed to load short ${dir.name}:`, error);
      }
    }

    console.log(`[AI Shorts] Loaded ${shorts.length} existing shorts`);
    return shorts.sort((a, b) => a.createdAt - b.createdAt);
  } catch (error) {
    console.error("[AI Shorts] Failed to load existing shorts:", error);
    return [];
  }
}

/**
 * Generate MORE AI shorts from the same video
 * Avoids duplicating existing segments but allows some overlap
 * @param videoPath - Input video file path (must be same as original)
 * @param projectId - Project ID for organizing outputs
 * @param existingShorts - Array of existing shorts to avoid duplication
 * @param onProgress - Progress callback
 * @param numShorts - Number of additional shorts to generate (1-10, default 5)
 * @returns Array of newly generated shorts
 */
export async function generateMoreAIShorts(
  videoPath: string,
  projectId: string,
  existingShorts: AIShort[],
  onProgress?: ProgressCallback,
  numShorts: number = 5
): Promise<AIShortsResult> {
  console.log("[AI Shorts] Generating MORE shorts...");
  console.log("[AI Shorts] Existing shorts:", existingShorts.length);
  console.log("[AI Shorts] Video:", videoPath);
  console.log("[AI Shorts] Project:", projectId);

  try {
    if (!isOpenAIReady()) {
      throw new Error(
        "OpenAI API not available. Please add OPENAI_API_KEY to your .env file."
      );
    }

    // Get project paths
    const homeDir = app.getPath("home");
    const projectPath = path.join(homeDir, "AxisPro", "projects", projectId);
    const shortsDir = path.join(projectPath, "shorts");

    // Load existing transcript if available
    const transcriptPath = path.join(shortsDir, "transcript.json");
    let transcript: {
      text: string;
      segments?: TranscriptSegment[];
      words?: WordTimestamp[];
    };

    try {
      const transcriptContent = await fs.readFile(transcriptPath, "utf-8");
      transcript = JSON.parse(transcriptContent);
      console.log("[AI Shorts] Using existing transcript");

      onProgress?.({
        status: "segmenting",
        message: "Using existing transcript...",
        progress: 30,
      });
    } catch {
      // Transcript doesn't exist, need to create it
      console.log("[AI Shorts] No existing transcript, creating new one");

      const tempDir = path.join(shortsDir, "temp");
      await fs.mkdir(tempDir, { recursive: true });

      onProgress?.({
        status: "transcribing",
        message: "Extracting audio...",
        progress: 10,
      });

      const audioPath = path.join(tempDir, "audio.mp3");
      await extractAudio(videoPath, audioPath);

      onProgress?.({
        status: "transcribing",
        message: "Transcribing with Whisper AI...",
        progress: 20,
      });

      transcript = await transcribeAudio(audioPath);

      // Save transcript for future use
      await fs.writeFile(transcriptPath, JSON.stringify(transcript, null, 2));

      // Cleanup temp audio
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    // Step 3: Analyze with GPT (with context of existing segments)
    onProgress?.({
      status: "segmenting",
      message: "Finding NEW highlights with GPT...",
      progress: 50,
    });

    const { probe } = await import("./ffmpegService.js");
    const mediaInfo = await probe(videoPath);
    const videoDurationMs = mediaInfo.duration;

    // Convert existing shorts to HighlightSegment format for GPT context
    const existingSegments: HighlightSegment[] = existingShorts.map(
      (short) => ({
        startMs: short.startMs,
        endMs: short.endMs,
        caption: short.caption,
        reasoning: "",
      })
    );

    const highlights = await analyzeHighlights(
      transcript.text,
      videoDurationMs,
      existingSegments, // Pass existing segments to avoid duplication
      numShorts
    );

    if (highlights.length === 0) {
      throw new Error("No new highlights found in video");
    }

    // Step 4: Render new shorts
    const newShorts: AIShort[] = [];
    const totalShorts = highlights.length;

    // Find next available short number
    const existingNumbers = existingShorts
      .map((s) => parseInt(s.id.replace("short-", "")))
      .filter((n) => !isNaN(n));
    let nextShortNumber =
      existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

    for (let i = 0; i < highlights.length; i++) {
      const highlight = highlights[i];
      const shortId = `short-${nextShortNumber++}`;
      const shortDir = path.join(shortsDir, shortId);
      await fs.mkdir(shortDir, { recursive: true });

      onProgress?.({
        status: "rendering",
        message: `Rendering short ${i + 1} of ${totalShorts}...`,
        progress: 50 + (i / totalShorts) * 40,
        currentShort: i + 1,
        totalShorts,
      });

      // Create SRT file with word-level timing if available
      const srtPath = path.join(shortDir, `${shortId}.srt`);

      if (transcript.words && transcript.words.length > 0) {
        // USE WORD-LEVEL TIMESTAMPS for accurate, synced subtitles
        const segmentWords = extractSegmentWords(
          transcript.words,
          highlight.startMs,
          highlight.endMs
        );

        if (segmentWords.length > 0) {
          console.log(
            `[AI Shorts] Using ${segmentWords.length} word timestamps for accurate subtitles`
          );
          await createSRTFromWords(
            segmentWords,
            highlight.startMs / 1000, // Convert to seconds for offset
            srtPath
          );
        } else {
          // Fallback if no words in this segment
          console.warn(
            "[AI Shorts] No word timestamps found for segment, using fallback"
          );
          const segmentTranscript = extractSegmentTranscript(
            transcript.segments || [],
            highlight.startMs,
            highlight.endMs
          );
          const captionText =
            segmentTranscript.length > 0 ? segmentTranscript : transcript.text;
          const captions = await generateCaptions(
            captionText,
            highlight.caption
          );
          await createSRTFile(
            captions,
            highlight.endMs - highlight.startMs,
            srtPath
          );
        }
      } else {
        // Fallback to old method if Whisper didn't provide word timestamps
        console.warn(
          "[AI Shorts] No word-level timestamps available, using fallback method"
        );
        const segmentTranscript = extractSegmentTranscript(
          transcript.segments || [],
          highlight.startMs,
          highlight.endMs
        );
        const captionText =
          segmentTranscript.length > 0 ? segmentTranscript : transcript.text;
        const captions = await generateCaptions(captionText, highlight.caption);
        await createSRTFile(
          captions,
          highlight.endMs - highlight.startMs,
          srtPath
        );
      }

      // Render video
      const videoOutputPath = path.join(shortDir, `${shortId}.mp4`);
      await renderShort(
        videoPath,
        highlight.startMs,
        highlight.endMs,
        srtPath,
        videoOutputPath
      );

      // Generate thumbnail
      const thumbnailPath = path.join(shortDir, `${shortId}-thumb.jpg`);
      await generateThumbnail(videoOutputPath, thumbnailPath);

      // Save metadata
      const jsonPath = path.join(shortDir, `${shortId}.json`);
      const metadata = {
        id: shortId,
        projectId,
        startMs: highlight.startMs,
        endMs: highlight.endMs,
        durationMs: highlight.endMs - highlight.startMs,
        caption: highlight.caption,
        reasoning: highlight.reasoning,
        hookScore: highlight.hookScore,
        retentionScore: highlight.retentionScore,
        useWordLevelTiming: !!(transcript.words && transcript.words.length > 0),
        createdAt: Date.now(),
      };
      await fs.writeFile(jsonPath, JSON.stringify(metadata, null, 2));

      newShorts.push({
        id: shortId,
        projectId,
        startMs: highlight.startMs,
        endMs: highlight.endMs,
        durationMs: highlight.endMs - highlight.startMs,
        caption: highlight.caption,
        videoPath: videoOutputPath,
        srtPath,
        jsonPath,
        thumbnailPath,
        createdAt: Date.now(),
      });
    }

    onProgress?.({
      status: "complete",
      message: `Generated ${newShorts.length} MORE shorts successfully!`,
      progress: 100,
      totalShorts: newShorts.length,
    });

    console.log(
      `[AI Shorts] Generate More complete: ${newShorts.length} new shorts`
    );

    return {
      success: true,
      shorts: newShorts,
    };
  } catch (error: any) {
    console.error("[AI Shorts] Generate More failed:", error);

    onProgress?.({
      status: "error",
      message: error.message || "Unknown error",
      progress: 0,
    });

    return {
      success: false,
      shorts: [],
      error: error.message,
    };
  }
}
