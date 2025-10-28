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
}

const RecordingPanel: React.FC<RecordingPanelProps> = ({
  projectId,
  onRecordingComplete,
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
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  /**
   * Load available desktop sources on mount
   */
  useEffect(() => {
    loadDesktopSources();
  }, []);

  /**
   * Cleanup streams on unmount
   */
  useEffect(() => {
    return () => {
      stopAllStreams();
    };
  }, []);

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

    if (!selectedSourceId) {
      setError("Please select a screen or window");
      return;
    }

    try {
      setError(null);
      console.log("[Recording] Starting recording...");

      // Get screen stream using Electron's desktopCapturer
      const screenStream = await navigator.mediaDevices.getUserMedia({
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

      // Get webcam stream if enabled
      let webcamStream: MediaStream | null = null;
      if (enableWebcam) {
        try {
          webcamStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
            audio: false,
          });
          webcamStreamRef.current = webcamStream;
          console.log("[Recording] Webcam stream acquired");
        } catch (err) {
          console.warn("[Recording] Webcam not available:", err);
        }
      }

      // Get microphone stream if enabled
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

      // Add screen video track
      screenStream.getVideoTracks().forEach((track) => {
        combinedStream.addTrack(track);
      });

      // Add webcam video track (will be composited in export)
      if (webcamStream) {
        webcamStream.getVideoTracks().forEach((track) => {
          combinedStream.addTrack(track);
        });
      }

      // Add microphone audio track
      if (micStream) {
        micStream.getAudioTracks().forEach((track) => {
          combinedStream.addTrack(track);
        });
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
      setRecordingTime(0);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      console.log("[Recording] Recording started");
    } catch (err) {
      console.error("[Recording] Failed to start recording:", err);
      setError(`Failed to start recording: ${err instanceof Error ? err.message : "Unknown error"}`);
      stopAllStreams();
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
      setError(`Failed to save recording: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  /**
   * Stop all active media streams
   */
  const stopAllStreams = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((track) => track.stop());
      webcamStreamRef.current = null;
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
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="recording-panel">
      <div className="recording-panel-header">
        <h3>Record</h3>
      </div>

      <div className="recording-panel-content">
        {/* Source Selection */}
        <div className="recording-source">
          <label>Source:</label>
          <button
            className="source-picker-btn"
            onClick={() => setShowSourcePicker(!showSourcePicker)}
            disabled={isRecording}
          >
            {selectedSource
              ? `${selectedSource.type === "screen" ? "🖥️" : "🪟"} ${selectedSource.name}`
              : "Select Source"}
          </button>

          {showSourcePicker && (
            <div className="source-picker-dropdown">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className={`source-option ${source.id === selectedSourceId ? "selected" : ""}`}
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

        {/* Recording Options */}
        <div className="recording-options">
          <label className="recording-toggle">
            <input
              type="checkbox"
              checked={enableWebcam}
              onChange={(e) => setEnableWebcam(e.target.checked)}
              disabled={isRecording}
            />
            <span>📷 Webcam</span>
          </label>

          <label className="recording-toggle">
            <input
              type="checkbox"
              checked={enableMic}
              onChange={(e) => setEnableMic(e.target.checked)}
              disabled={isRecording}
            />
            <span>🎤 Microphone</span>
          </label>
        </div>

        {/* Recording Controls */}
        <div className="recording-controls">
          {!isRecording ? (
            <button
              className="recording-btn start-btn"
              onClick={startRecording}
              disabled={!projectId || !selectedSourceId}
            >
              <span className="record-dot"></span>
              Start Recording
            </button>
          ) : (
            <>
              <div className="recording-time">{formatTime(recordingTime)}</div>
              <button className="recording-btn stop-btn" onClick={stopRecording}>
                <span className="stop-square"></span>
                Stop Recording
              </button>
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

