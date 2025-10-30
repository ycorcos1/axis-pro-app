/**
 * AI Shorts Component
 * @mem ref: pr17-ai-shorts
 * Generates short-form vertical videos using AI (Whisper + GPT)
 */

import React, { useState, useEffect } from "react";
import "./AIShorts.css";

interface AIShort {
  id: string;
  projectId: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  caption: string;
  videoPath: string;
  srtPath: string;
  jsonPath: string;
  thumbnailPath?: string;
  createdAt: number;
}

interface AIShortsJobProgress {
  status:
    | "idle"
    | "transcribing"
    | "segmenting"
    | "rendering"
    | "complete"
    | "error";
  message: string;
  progress: number;
  currentShort?: number;
  totalShorts?: number;
}

interface AIShortsResult {
  success: boolean;
  shorts: AIShort[];
  error?: string;
}

interface AIShortsProps {
  projectId: string;
  onClose: () => void;
}

const AIShorts: React.FC<AIShortsProps> = ({ projectId, onClose }) => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [originalVideoPath, setOriginalVideoPath] = useState<string | null>(
    null
  );
  const [numShorts, setNumShorts] = useState<number>(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<AIShortsJobProgress>({
    status: "idle",
    message: "",
    progress: 0,
  });
  const [shorts, setShorts] = useState<AIShort[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewShort, setPreviewShort] = useState<AIShort | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Check if AI Shorts is available on mount
  useEffect(() => {
    checkAvailability();
    loadExistingShorts();
  }, [projectId]);

  const loadExistingShorts = async () => {
    // Check if this project has existing shorts
    console.log("[AI Shorts] Loading existing shorts for project:", projectId);
    try {
      const existingShorts = await window.electronAPI.aiShorts.load(projectId);
      if (existingShorts && existingShorts.length > 0) {
        console.log(
          "[AI Shorts] Loaded",
          existingShorts.length,
          "existing shorts"
        );
        setShorts(existingShorts);
        // Try to get original video path from project metadata
        // For now, we'll let user know they need to select video again if they want more
        setProgress({
          status: "complete",
          message: `Loaded ${existingShorts.length} shorts`,
          progress: 100,
        });
      }
    } catch (error) {
      console.error("[AI Shorts] Failed to load existing shorts:", error);
    }
  };

  // Listen for progress updates
  useEffect(() => {
    const unsubscribe = window.electronAPI.aiShorts.onProgress(
      (progressUpdate: AIShortsJobProgress) => {
        console.log("[AI Shorts] Progress update:", progressUpdate);
        setProgress(progressUpdate);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const checkAvailability = async () => {
    try {
      const available = await window.electronAPI.aiShorts.checkAvailable();
      setIsAvailable(available);
      if (!available) {
        setError(
          "AI Shorts requires an OpenAI API key. Please add OPENAI_API_KEY to your .env file."
        );
      }
    } catch (err) {
      console.error("[AI Shorts] Availability check failed:", err);
      setIsAvailable(false);
      setError("Failed to check AI Shorts availability");
    }
  };

  const handleFileSelect = async () => {
    try {
      const files = await window.electronAPI.selectFiles();
      if (files && files.length > 0) {
        setSelectedFile(files[0]);
        setError(null);
        console.log("[AI Shorts] Selected file:", files[0]);
      }
    } catch (err) {
      console.error("[AI Shorts] File selection failed:", err);
      setError("Failed to select file");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];

    // Check if it's a video file
    const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];
    const fileName = file.name.toLowerCase();
    const isVideo = videoExtensions.some((ext) => fileName.endsWith(ext));

    if (!isVideo) {
      setError("Please drop a video file (MP4, MOV, AVI, MKV, WEBM, M4V)");
      return;
    }

    try {
      // Use Electron's webUtils.getPathForFile to get the real file path
      const filePath = window.electronAPI.getFilePathFromFile(file);
      console.log("[AI Shorts] Dropped file path:", filePath);

      setSelectedFile(filePath);
      setError(null);
      console.log("[AI Shorts] Successfully set dropped file:", filePath);
    } catch (error) {
      console.error("[AI Shorts] Failed to get file path:", error);
      setError(
        "Failed to read dropped file. Please use 'Select Video' button."
      );
    }
  };

  const handleGenerate = async () => {
    if (!selectedFile) {
      setError("Please select a video file first");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress({
      status: "transcribing",
      message: "Starting generation...",
      progress: 0,
    });

    try {
      console.log("[AI Shorts] Starting generation...");
      const result: AIShortsResult = await window.electronAPI.aiShorts.generate(
        selectedFile,
        projectId,
        numShorts
      );

      if (result.success) {
        console.log("[AI Shorts] Generation successful:", result.shorts.length);
        setShorts(result.shorts);
        setOriginalVideoPath(selectedFile); // Store video path for "Generate More"
        setProgress({
          status: "complete",
          message: `Generated ${result.shorts.length} shorts!`,
          progress: 100,
        });
      } else {
        console.error("[AI Shorts] Generation failed:", result.error);
        setError(result.error || "Generation failed");
        setProgress({
          status: "error",
          message: result.error || "Unknown error",
          progress: 0,
        });
      }
    } catch (err: any) {
      console.error("[AI Shorts] Generation error:", err);
      setError(err.message || "Generation failed");
      setProgress({
        status: "error",
        message: err.message || "Unknown error",
        progress: 0,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateMore = async () => {
    // If we don't have the original video path, ask user to select it
    if (!originalVideoPath && !selectedFile) {
      try {
        const files = await window.electronAPI.selectFiles();
        if (files && files.length > 0) {
          setOriginalVideoPath(files[0]);
          setSelectedFile(files[0]);
          // Now proceed with generation
          await generateMoreWithPath(files[0]);
        } else {
          setError("Please select the original video to generate more shorts");
        }
      } catch (err) {
        console.error("[AI Shorts] File selection failed:", err);
        setError("Failed to select file");
      }
      return;
    }

    const videoPath = originalVideoPath || selectedFile;
    if (!videoPath) {
      setError("Video path not found");
      return;
    }

    await generateMoreWithPath(videoPath);
  };

  const generateMoreWithPath = async (videoPath: string) => {
    setIsGenerating(true);
    setError(null);
    setProgress({
      status: "segmenting",
      message: "Generating MORE shorts...",
      progress: 0,
    });

    try {
      console.log("[AI Shorts] Generating MORE shorts...");
      const result: AIShortsResult =
        await window.electronAPI.aiShorts.generateMore(
          videoPath,
          projectId,
          shorts,
          numShorts
        );

      if (result.success) {
        console.log(
          "[AI Shorts] Generated",
          result.shorts.length,
          "more shorts"
        );
        // Append new shorts to existing ones
        const allShorts = [...shorts, ...result.shorts];
        setShorts(allShorts);
        setProgress({
          status: "complete",
          message: `Generated ${result.shorts.length} MORE shorts!`,
          progress: 100,
        });
      } else {
        console.error("[AI Shorts] Generate More failed:", result.error);
        setError(result.error || "Generation failed");
        setProgress({
          status: "error",
          message: result.error || "Unknown error",
          progress: 0,
        });
      }
    } catch (err: any) {
      console.error("[AI Shorts] Generate More error:", err);
      setError(err.message || "Generation failed");
      setProgress({
        status: "error",
        message: err.message || "Unknown error",
        progress: 0,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportShort = async (short: AIShort) => {
    try {
      const defaultName = `${short.caption
        .substring(0, 30)
        .replace(/[^a-z0-9]/gi, "_")}.mp4`;
      const savePath = await window.electronAPI.selectSavePath(defaultName);

      if (savePath) {
        // Copy file to selected location using IPC
        await window.electronAPI.copyFile(short.videoPath, savePath);
        console.log("[AI Shorts] Exported:", savePath);
      }
    } catch (err) {
      console.error("[AI Shorts] Export failed:", err);
      setError("Failed to export short");
    }
  };

  const handleExportAll = async () => {
    if (shorts.length === 0) return;

    try {
      const result = await window.electronAPI.showOpenDialog({
        properties: ["openDirectory", "createDirectory"],
        title: "Select Export Folder",
      });

      if (result && result.length > 0) {
        const exportDir = result[0];

        for (let i = 0; i < shorts.length; i++) {
          const short = shorts[i];
          const filename = `${short.id}_${short.caption
            .substring(0, 30)
            .replace(/[^a-z0-9]/gi, "_")}.mp4`;
          const destPath = `${exportDir}/${filename}`;
          await window.electronAPI.copyFile(short.videoPath, destPath);
        }

        console.log(
          `[AI Shorts] Exported all ${shorts.length} shorts to:`,
          exportDir
        );
      }
    } catch (err) {
      console.error("[AI Shorts] Export all failed:", err);
      setError("Failed to export all shorts");
    }
  };

  const formatDuration = (durationMs: number): string => {
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handlePreviewShort = (short: AIShort) => {
    setPreviewShort(short);
  };

  const handleClosePreview = () => {
    setPreviewShort(null);
  };

  // Show preview modal if a short is selected
  if (previewShort) {
    return (
      <div className="ai-shorts">
        <div className="ai-shorts-header">
          <h2>Preview: {previewShort.caption}</h2>
          <button className="btn-close" onClick={handleClosePreview}>
            ×
          </button>
        </div>
        <div className="ai-shorts-preview">
          <div className="preview-container">
            <video
              key={previewShort.id}
              src={`file://${previewShort.videoPath}`}
              controls
              loop
              className="preview-video"
              onError={(e) => {
                console.error("[AI Shorts] Video preview error");
                console.error(
                  "[AI Shorts] Video path:",
                  previewShort.videoPath
                );
                setError(
                  "Failed to load video preview. The file may have been moved or deleted."
                );
              }}
              onLoadedMetadata={() => {
                console.log("[AI Shorts] Video loaded successfully");
              }}
            />
            <div className="preview-info">
              <h3>{previewShort.caption}</h3>
              <div className="preview-meta">
                <span>Duration: {formatDuration(previewShort.durationMs)}</span>
                <span>•</span>
                <span>1080×1920 (9:16)</span>
              </div>
              <div className="preview-actions">
                <button
                  className="btn-primary"
                  onClick={() => handleExportShort(previewShort)}
                >
                  Export This Short
                </button>
                <button className="btn-secondary" onClick={handleClosePreview}>
                  Back to All Shorts
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state while checking availability
  if (isAvailable === false && !error) {
    return (
      <div className="ai-shorts">
        <div className="ai-shorts-header">
          <h2>AI Shorts (Beta)</h2>
          <button className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="ai-shorts-loading">Checking availability...</div>
      </div>
    );
  }

  // Error state (API key not available)
  if (!isAvailable && error) {
    return (
      <div className="ai-shorts">
        <div className="ai-shorts-header">
          <h2>AI Shorts (Beta)</h2>
          <button className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="ai-shorts-error">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <p className="error-hint">
            Add your OpenAI API key to a .env file in the project root:
            <br />
            <code>OPENAI_API_KEY=sk-...</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-shorts">
      <div className="ai-shorts-header">
        <h2>AI Shorts (Beta)</h2>
        <button className="btn-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="ai-shorts-content">
        {/* Upload Section */}
        {!isGenerating && shorts.length === 0 && (
          <div className="ai-shorts-upload">
            <div
              className={`upload-card ${isDragging ? "dragging" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="upload-icon">🎬</div>
              <h3>Generate AI-Powered Shorts</h3>
              <p>
                Upload a long video and let AI create engaging short clips with
                captions automatically.
              </p>
              <p className="upload-hint">
                Drag and drop a video here or click to select
              </p>

              {selectedFile && (
                <div className="selected-file">
                  <span className="file-icon">📁</span>
                  <span className="file-name">
                    {selectedFile.split("/").pop()}
                  </span>
                </div>
              )}

              <div className="shorts-count-control">
                <label htmlFor="numShorts">Number of shorts to generate:</label>
                <div className="count-input-wrapper">
                  <button
                    className="count-btn"
                    onClick={() => setNumShorts(Math.max(1, numShorts - 1))}
                    disabled={numShorts <= 1}
                  >
                    −
                  </button>
                  <input
                    id="numShorts"
                    type="number"
                    min="1"
                    max="10"
                    value={numShorts}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1 && val <= 10) {
                        setNumShorts(val);
                      }
                    }}
                    className="count-input"
                  />
                  <button
                    className="count-btn"
                    onClick={() => setNumShorts(Math.min(10, numShorts + 1))}
                    disabled={numShorts >= 10}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="upload-actions">
                <button className="btn-secondary" onClick={handleFileSelect}>
                  {selectedFile ? "Change Video" : "Select Video"}
                </button>
                <button
                  className="btn-primary"
                  onClick={handleGenerate}
                  disabled={!selectedFile}
                >
                  Generate Shorts
                </button>
              </div>

              {error && <div className="error-message">{error}</div>}
            </div>
          </div>
        )}

        {/* Progress Section */}
        {isGenerating && (
          <div className="ai-shorts-progress">
            <div className="progress-card">
              <h3>{progress.message}</h3>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <div className="progress-details">
                <span className="progress-status">
                  {progress.status === "transcribing" && "🎤 Transcribing..."}
                  {progress.status === "segmenting" && "🤖 Analyzing..."}
                  {progress.status === "rendering" && "🎬 Rendering..."}
                </span>
                {progress.currentShort && progress.totalShorts && (
                  <span className="progress-count">
                    Short {progress.currentShort} of {progress.totalShorts}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results Grid */}
        {shorts.length > 0 && (
          <div className="ai-shorts-results">
            <div className="results-header">
              <h3>Generated Shorts ({shorts.length})</h3>
            </div>

            <div className="shorts-grid">
              {shorts.map((short) => (
                <div key={short.id} className="short-card">
                  <div className="short-thumbnail">
                    {short.thumbnailPath ? (
                      <img
                        src={`local-image://${short.thumbnailPath}`}
                        alt={short.caption}
                      />
                    ) : (
                      <div className="thumbnail-placeholder">
                        <span>🎥</span>
                      </div>
                    )}
                    <div className="short-duration">
                      {formatDuration(short.durationMs)}
                    </div>
                  </div>

                  <div className="short-info">
                    <h4 className="short-caption">{short.caption}</h4>
                    <div className="short-meta">
                      <span className="meta-item">1080×1920</span>
                      <span className="meta-separator">•</span>
                      <span className="meta-item">
                        {formatDuration(short.durationMs)}
                      </span>
                    </div>
                  </div>

                  <div className="short-actions">
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => handlePreviewShort(short)}
                    >
                      Preview
                    </button>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => handleExportShort(short)}
                    >
                      Export
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="results-footer">
              <button
                className="btn-primary"
                onClick={handleGenerateMore}
                disabled={isGenerating}
              >
                {isGenerating ? "Generating..." : "Generate 5 More Shorts"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIShorts;
