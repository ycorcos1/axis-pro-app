/**
 * Recording Panel Component
 * @mem ref: pr13-recording-suite
 * Compact HUD for screen/window capture with webcam and mic toggles
 */

import React, { useState, useEffect, useRef } from "react";
import "./RecordingPanel.css";

interface DesktopSource {
  id: string;
  name: string;
  type: "screen" | "window";
  thumbnail?: string;
}

interface RecordingPanelProps {
  projectId: string | null;
  onRecordingComplete: (filePath: string) => void;
  mode: "movie" | "audio" | "screen" | "screen-camera" | null;
  onClose: () => void;
}

const RecordingPanel: React.FC<RecordingPanelProps> = ({
  projectId,
  onRecordingComplete,
  mode,
  onClose,
}) => {
  // Source selection
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  // Recording options
  const [enableWebcam, setEnableWebcam] = useState(false);
  const [enableMic, setEnableMic] = useState(true);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const screenPreviewRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Load available desktop sources on mount
   */
  useEffect(() => {
    loadDesktopSources();

    // Set initial options based on mode
    if (mode === "movie") {
      setEnableWebcam(true);
      setEnableMic(true);
      // Initialize webcam preview for movie mode
      initializeWebcamPreview();
    } else if (mode === "audio") {
      setEnableWebcam(false);
      setEnableMic(true);
    } else if (mode === "screen") {
      setEnableWebcam(false);
      setEnableMic(true);
    } else if (mode === "screen-camera") {
      setEnableWebcam(true);
      setEnableMic(true);
      // Initialize webcam preview for PiP mode
      initializeWebcamPreview();
    }
  }, [mode]);

  /**
   * Cleanup streams on unmount
   */
  useEffect(() => {
    return () => {
      stopAllStreams();
    };
  }, []);

  /**
   * Initialize screen preview when source changes in PiP mode
   */
  useEffect(() => {
    if (mode === "screen-camera" && selectedSourceId) {
      initializeScreenPreview();
    }
  }, [selectedSourceId, mode]);

  /**
   * Load available desktop capture sources
   */
  const loadDesktopSources = async () => {
    try {
      const availableSources = await window.electronAPI.getDesktopSources();
      setSources(availableSources);

      // Auto-select first screen if available
      const firstScreen = availableSources.find((s) => s.type === "screen");
      if (firstScreen) {
        setSelectedSourceId(firstScreen.id);
      }
    } catch (err) {
      console.error("[Recording] Failed to load sources:", err);
      setError("Failed to load capture sources");
    }
  };

  /**
   * Initialize webcam preview for movie mode
   */
  const initializeWebcamPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false, // Don't capture audio for preview
      });

      webcamStreamRef.current = stream;

      // Set video preview
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        // Use a promise-based play with error handling
        videoPreviewRef.current.play().catch((err) => {
          // Ignore AbortError as it's harmless (interrupted by new load)
          if (err.name !== "AbortError") {
            console.warn("[Recording] Video play warning:", err);
          }
        });
      }

      console.log("[Recording] Webcam preview initialized");
    } catch (err) {
      console.error("[Recording] Failed to initialize webcam preview:", err);
      setError("Failed to access webcam. Please check permissions.");
    }
  };

  /**
   * Initialize screen preview for PiP mode
   */
  const initializeScreenPreview = async () => {
    if (!selectedSourceId) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          // @ts-ignore - Electron-specific constraint
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: selectedSourceId,
          },
        } as any,
      });

      screenStreamRef.current = stream;

      // Set screen preview
      if (screenPreviewRef.current) {
        screenPreviewRef.current.srcObject = stream;
        screenPreviewRef.current.play().catch((err) => {
          if (err.name !== "AbortError") {
            console.warn("[Recording] Screen preview play warning:", err);
          }
        });
      }

      console.log("[Recording] Screen preview initialized");
    } catch (err) {
      console.error("[Recording] Failed to initialize screen preview:", err);
      setError("Failed to access screen. Please check permissions.");
    }
  };

  /**
   * Get the selected source object
   */
  const selectedSource = sources.find((s) => s.id === selectedSourceId);

  /**
   * Start recording
   */
  const startRecording = async () => {
    if (!projectId) {
      setError("No project selected");
      return;
    }

    // For screen modes, require source selection
    if ((mode === "screen" || mode === "screen-camera") && !selectedSourceId) {
      setError("Please select a screen or window");
      return;
    }

    try {
      setError(null);
      console.log("[Recording] Starting recording...");

      let screenStream: MediaStream | null = null;

      // Get screen stream only for screen/screen-camera modes
      if (mode === "screen" || mode === "screen-camera") {
        if (!selectedSourceId) {
          setError("Please select a screen or window");
          return;
        }

        screenStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            // @ts-ignore - Electron-specific constraint
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: selectedSourceId,
            },
          } as any,
        });

        screenStreamRef.current = screenStream;
        console.log("[Recording] Screen stream acquired");
      }

      // Get webcam stream if enabled (movie mode or screen-camera mode)
      let webcamStream: MediaStream | null = null;
      if (enableWebcam || mode === "movie" || mode === "screen-camera") {
        // For movie mode and screen-camera mode, reuse the preview stream if available
        if (
          (mode === "movie" || mode === "screen-camera") &&
          webcamStreamRef.current
        ) {
          webcamStream = webcamStreamRef.current;
          console.log("[Recording] Reusing webcam preview stream");
        } else {
          // Otherwise, create a new stream
          try {
            webcamStream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user",
              },
              audio: false,
            });
            webcamStreamRef.current = webcamStream;
            console.log("[Recording] Webcam stream acquired");

            // Set up preview if in movie or screen-camera mode and not already playing
            if (
              (mode === "movie" || mode === "screen-camera") &&
              videoPreviewRef.current &&
              !videoPreviewRef.current.srcObject
            ) {
              videoPreviewRef.current.srcObject = webcamStream;
              videoPreviewRef.current.play().catch((err) => {
                // Ignore AbortError as it's harmless
                if (err.name !== "AbortError") {
                  console.warn("[Recording] Video play warning:", err);
                }
              });
            }
          } catch (err) {
            console.error("[Recording] Webcam not available:", err);
            setError("Failed to access webcam. Please check permissions.");
            stopAllStreams();
            return;
          }
        }
      }

      // Get microphone stream if enabled (need fresh stream with audio)
      let micStream: MediaStream | null = null;
      if (enableMic) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          micStreamRef.current = micStream;
          console.log("[Recording] Microphone stream acquired");
        } catch (err) {
          console.warn("[Recording] Microphone not available:", err);
        }
      }

      // Combine streams
      const combinedStream = new MediaStream();

      // For screen-camera mode, we need to composite using canvas
      if (mode === "screen-camera" && screenStream && webcamStream) {
        console.log("[Recording] Compositing screen + webcam using canvas");
        
        // Create canvas for compositing
        const canvas = document.createElement("canvas");
        canvasRef.current = canvas;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          setError("Failed to create canvas context");
          stopAllStreams();
          return;
        }

        // Set canvas size to match screen resolution
        const screenTrack = screenStream.getVideoTracks()[0];
        const settings = screenTrack.getSettings();
        canvas.width = settings.width || 1920;
        canvas.height = settings.height || 1080;

        // Create video elements for drawing
        const screenVideo = document.createElement("video");
        const webcamVideo = document.createElement("video");
        
        screenVideo.srcObject = screenStream;
        webcamVideo.srcObject = webcamStream;
        
        await screenVideo.play();
        await webcamVideo.play();

        // Composite function
        const drawFrame = () => {
          // Draw screen (full canvas)
          ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
          
          // Calculate webcam overlay position (bottom-left, 25% width)
          const webcamWidth = canvas.width * 0.25;
          const webcamHeight = webcamWidth * 0.75; // 4:3 aspect ratio
          const webcamX = 12;
          const webcamY = canvas.height - webcamHeight - 12;
          
          // Draw webcam overlay with border
          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
          ctx.lineWidth = 2;
          ctx.strokeRect(webcamX, webcamY, webcamWidth, webcamHeight);
          ctx.drawImage(webcamVideo, webcamX, webcamY, webcamWidth, webcamHeight);
          
          animationFrameRef.current = requestAnimationFrame(drawFrame);
        };
        
        drawFrame();
        
        // Get stream from canvas
        const canvasStream = canvas.captureStream(30); // 30 fps
        canvasStream.getVideoTracks().forEach((track) => {
          combinedStream.addTrack(track);
        });
      } else {
        // For non-PiP modes, add tracks normally
        // Add screen video track (if screen recording)
        if (screenStream) {
          screenStream.getVideoTracks().forEach((track) => {
            combinedStream.addTrack(track);
          });
        }

        // Add webcam video track
        if (webcamStream) {
          webcamStream.getVideoTracks().forEach((track) => {
            combinedStream.addTrack(track);
          });
        }
      }

      // Add microphone audio track
      if (micStream) {
        micStream.getAudioTracks().forEach((track) => {
          combinedStream.addTrack(track);
        });
      }

      // Verify we have at least one video or audio track
      if (combinedStream.getTracks().length === 0) {
        setError(
          "No media streams available. Please enable webcam or microphone."
        );
        stopAllStreams();
        return;
      }

      // Create MediaRecorder
      const options = {
        mimeType: "video/webm;codecs=vp8,opus",
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      };

      const mediaRecorder = new MediaRecorder(combinedStream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        console.log("[Recording] Recording stopped, processing...");
        await handleRecordingStop();
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every 1 second
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      console.log("[Recording] Recording started");
    } catch (err) {
      console.error("[Recording] Failed to start recording:", err);
      setError(
        `Failed to start recording: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
      stopAllStreams();
    }
  };

  /**
   * Pause recording
   */
  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      console.log("[Recording] Pausing recording...");
      mediaRecorderRef.current.pause();
      setIsPaused(true);

      // Pause timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  /**
   * Resume recording
   */
  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      console.log("[Recording] Resuming recording...");
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      // Resume timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  };

  /**
   * Stop recording
   */
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log("[Recording] Stopping recording...");
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  /**
   * Handle recording stop - save and remux
   */
  const handleRecordingStop = async () => {
    if (!projectId) return;

    try {
      // Create blob from chunks
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      console.log("[Recording] Blob created:", blob.size, "bytes");

      // Generate filename
      const timestamp = Date.now();
      const webmFileName = `recording-${timestamp}.webm`;
      const mp4FileName = `recording-${timestamp}.mp4`;

      // Save WebM file to project recordings directory
      const arrayBuffer = await blob.arrayBuffer();
      const webmPath = await window.electronAPI.saveRecordingChunk(
        projectId,
        webmFileName,
        arrayBuffer
      );

      console.log("[Recording] WebM saved:", webmPath);

      // Remux to MP4
      const mp4Path = webmPath.replace(".webm", ".mp4");
      await window.electronAPI.remuxRecording(webmPath, mp4Path);

      console.log("[Recording] Remux completed:", mp4Path);

      // Notify parent component
      onRecordingComplete(mp4Path);

      // Cleanup
      stopAllStreams();
      chunksRef.current = [];
    } catch (err) {
      console.error("[Recording] Failed to process recording:", err);
      setError(
        `Failed to save recording: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  };

  /**
   * Stop all active media streams
   */
  const stopAllStreams = () => {
    // Stop animation frame for canvas compositing
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Clean up canvas
    if (canvasRef.current) {
      canvasRef.current = null;
    }
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((track) => track.stop());
      webcamStreamRef.current = null;
      // Clear video preview
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
  };

  /**
   * Format recording time as MM:SS
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  /**
   * Handle panel close - stop streams before closing
   */
  const handleClose = () => {
    console.log("[Recording] Closing panel and stopping streams");
    stopAllStreams();
    onClose();
  };

  return (
    <div className="recording-panel">
      <div className="recording-panel-header">
        <h3>
          {mode === "movie" && "Movie Recording"}
          {mode === "audio" && "Audio Recording"}
          {mode === "screen" && "Screen Recording"}
          {mode === "screen-camera" && "Screen Recording with Camera"}
        </h3>
        <button
          className="close-btn"
          onClick={handleClose}
          disabled={isRecording}
        >
          ×
        </button>
      </div>

      <div className="recording-panel-content">
        {/* Source Selection - Only show for screen modes */}
        {(mode === "screen" || mode === "screen-camera") && (
          <div
            className={`recording-source ${
              showSourcePicker ? "dropdown-open" : ""
            }`}
          >
            <label>Source:</label>
            <button
              className="source-picker-btn"
              onClick={() => setShowSourcePicker(!showSourcePicker)}
              disabled={isRecording}
            >
              {selectedSource
                ? `${selectedSource.type === "screen" ? "🖥️" : "🪟"} ${
                    selectedSource.name
                  }`
                : "Select Source"}
            </button>

            {showSourcePicker && (
              <div className="source-picker-dropdown">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className={`source-option ${
                      source.id === selectedSourceId ? "selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedSourceId(source.id);
                      setShowSourcePicker(false);
                    }}
                  >
                    {source.thumbnail && (
                      <img
                        src={source.thumbnail}
                        alt={source.name}
                        className="source-thumbnail"
                      />
                    )}
                    <div className="source-info">
                      <span className="source-type">
                        {source.type === "screen" ? "🖥️ Screen" : "🪟 Window"}
                      </span>
                      <span className="source-name">{source.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recording Options */}
        <div className="recording-options">
          {mode !== "movie" && (
            <label className="recording-toggle">
              <input
                type="checkbox"
                checked={enableMic}
                onChange={(e) => setEnableMic(e.target.checked)}
                disabled={isRecording}
              />
              <span>🎤 Microphone</span>
            </label>
          )}
        </div>

        {/* Video Preview for Movie Mode */}
        {mode === "movie" && (
          <div className="video-preview-container">
            <video
              ref={videoPreviewRef}
              className="video-preview"
              autoPlay
              muted
              playsInline
            />
          </div>
        )}

        {/* PiP Preview for Screen + Camera Mode */}
        {mode === "screen-camera" && (
          <div className="pip-preview-container">
            <div className="pip-preview-label">
              Preview: Screen + Camera (bottom-left)
            </div>
            <div className="pip-preview-content">
              <video
                ref={screenPreviewRef}
                className="pip-screen-preview"
                autoPlay
                muted
                playsInline
              />
              {!selectedSourceId && (
                <div className="pip-screen-placeholder">
                  <span>🖥️ Select a screen source above</span>
                </div>
              )}
              <video
                ref={videoPreviewRef}
                className="pip-webcam-overlay"
                autoPlay
                muted
                playsInline
              />
            </div>
          </div>
        )}

        {/* Recording Controls */}
        <div className="recording-controls">
          {!isRecording ? (
            <button
              className="recording-btn start-btn"
              onClick={startRecording}
              disabled={
                !projectId ||
                ((mode === "screen" || mode === "screen-camera") &&
                  !selectedSourceId)
              }
            >
              <span className="record-dot"></span>
              Start Recording
            </button>
          ) : (
            <>
              <div className="recording-time">{formatTime(recordingTime)}</div>
              <div className="recording-controls-row">
                {isPaused ? (
                  <button
                    className="recording-btn resume-btn"
                    onClick={resumeRecording}
                  >
                    ▶ Resume
                  </button>
                ) : (
                  <button
                    className="recording-btn pause-btn"
                    onClick={pauseRecording}
                  >
                    ⏸ Pause
                  </button>
                )}
                <button
                  className="recording-btn stop-btn"
                  onClick={stopRecording}
                >
                  <span className="stop-square"></span>
                  Stop
                </button>
              </div>
            </>
          )}
        </div>

        {/* Error Display */}
        {error && <div className="recording-error">{error}</div>}
      </div>
    </div>
  );
};

export default RecordingPanel;
