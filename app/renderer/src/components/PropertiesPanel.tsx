/**
 * PropertiesPanel Component
 * @mem ref: design-spec
 * Right panel for clip properties and export settings
 */

import React, { useState } from "react";
import "./PropertiesPanel.css";

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
}

interface PropertiesPanelProps {
  clip: Clip | null;
  onUpdateTrim: (clipId: string, inMs: number, outMs: number) => void;
  onExport: () => void;
  projectTitle?: string;
  projectId?: string | null;
  onUpdateProjectTitle?: (projectId: string, newTitle: string) => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  clip,
  onUpdateTrim,
  onExport,
  projectTitle,
  projectId,
  onUpdateProjectTitle,
}) => {
  const [activeTab, setActiveTab] = useState<"clip" | "project">("clip");
  const [exportPreset, setExportPreset] = useState<string>("source");
  const [editingIn, setEditingIn] = useState(false);
  const [editingOut, setEditingOut] = useState(false);
  const [editingProjectTitle, setEditingProjectTitle] = useState(false);
  const [projectTitleValue, setProjectTitleValue] = useState(
    projectTitle || ""
  );

  // Update project title value when prop changes
  React.useEffect(() => {
    setProjectTitleValue(projectTitle || "");
  }, [projectTitle]);

  // Format time in MM:SS:MS
  const formatTimecode = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`;
  };

  // Format duration as MM:SS
  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Nudge functions: 1 minute = 60000ms, 5 minutes = 300000ms

  // Parse timecode string to milliseconds
  const parseTimecode = (timecode: string): number | null => {
    const match = timecode.match(/^(\d+):(\d{2})\.(\d{2})$/);
    if (!match) return null;
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    const centiseconds = parseInt(match[3]);
    return (minutes * 60 + seconds) * 1000 + centiseconds * 10;
  };

  const handleNudgeIn = (minutes: number) => {
    if (!clip) return;
    const newInMs = Math.max(0, clip.inMs + minutes * 60000);
    onUpdateTrim(clip.id, newInMs, clip.outMs);
  };

  const handleNudgeOut = (minutes: number) => {
    if (!clip) return;
    const newOutMs = Math.min(clip.duration, clip.outMs + minutes * 60000);
    onUpdateTrim(clip.id, clip.inMs, newOutMs);
  };

  // Handle manual timecode input for In point
  const handleInChange = (value: string) => {
    if (!clip) return;
    const ms = parseTimecode(value);
    if (ms !== null && ms >= 0 && ms < clip.outMs) {
      onUpdateTrim(clip.id, ms, clip.outMs);
      setEditingIn(false);
    }
  };

  // Handle manual timecode input for Out point
  const handleOutChange = (value: string) => {
    if (!clip) return;
    const ms = parseTimecode(value);
    if (ms !== null && ms > clip.inMs && ms <= clip.duration) {
      onUpdateTrim(clip.id, clip.inMs, ms);
      setEditingOut(false);
    }
  };

  // Calculate trimmed duration
  const trimmedDuration = clip ? clip.outMs - clip.inMs : 0;

  return (
    <div className="properties-panel">
      <div className="panel-header">
        <h2 className="panel-title">Properties</h2>
      </div>

      {/* Tab switcher */}
      <div className="properties-tabs">
        <button
          className={`tab-button ${activeTab === "clip" ? "active" : ""}`}
          onClick={() => setActiveTab("clip")}
        >
          Clip
        </button>
        <button
          className={`tab-button ${activeTab === "project" ? "active" : ""}`}
          onClick={() => setActiveTab("project")}
        >
          Project
        </button>
      </div>

      <div className="properties-content">
        {activeTab === "clip" && (
          <>
            <div className="properties-section">
              <h3 className="section-title">Clip Info</h3>
              <div className="property-item">
                <span className="property-label">Duration</span>
                <span className="property-value">
                  {clip ? formatDuration(clip.duration) : "--:--"}
                </span>
              </div>
              <div className="property-item">
                <span className="property-label">Resolution</span>
                <span className="property-value">
                  {clip ? `${clip.width}×${clip.height}` : "-- x --"}
                </span>
              </div>
              <div className="property-item">
                <span className="property-label">Path</span>
                <span
                  className="property-value property-path"
                  title={clip?.path}
                >
                  {clip ? clip.filename : "--"}
                </span>
              </div>
            </div>

            <div className="properties-section">
              <h3 className="section-title">Trim Points</h3>
              {clip && (
                <div className="trim-info">
                  <span className="trim-info-label">Trimmed Duration:</span>
                  <span className="trim-info-value">
                    {formatDuration(trimmedDuration)}
                  </span>
                </div>
              )}
              <div className="trim-controls">
                <div className="trim-control">
                  <div className="trim-label-row">
                    <label className="trim-label">In</label>
                  </div>
                  <div className="trim-input-row">
                    <input
                      type="text"
                      className={`trim-input ${editingIn ? "editing" : ""}`}
                      value={clip ? formatTimecode(clip.inMs) : "00:00.00"}
                      readOnly={!editingIn}
                      onDoubleClick={() => setEditingIn(true)}
                      onBlur={(e) => {
                        handleInChange(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleInChange(e.currentTarget.value);
                        } else if (e.key === "Escape") {
                          setEditingIn(false);
                        }
                      }}
                    />
                    <div className="nudge-buttons">
                      <button
                        className="nudge-button"
                        onClick={() => handleNudgeIn(-1)}
                        disabled={!clip}
                        title="-1 minute"
                      >
                        −1m
                      </button>
                      <button
                        className="nudge-button"
                        onClick={() => handleNudgeIn(1)}
                        disabled={!clip}
                        title="+1 minute"
                      >
                        +1m
                      </button>
                    </div>
                  </div>
                </div>

                <div className="trim-control">
                  <div className="trim-label-row">
                    <label className="trim-label">Out</label>
                  </div>
                  <div className="trim-input-row">
                    <input
                      type="text"
                      className={`trim-input ${editingOut ? "editing" : ""}`}
                      value={clip ? formatTimecode(clip.outMs) : "00:00.00"}
                      readOnly={!editingOut}
                      onDoubleClick={() => setEditingOut(true)}
                      onBlur={(e) => {
                        handleOutChange(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleOutChange(e.currentTarget.value);
                        } else if (e.key === "Escape") {
                          setEditingOut(false);
                        }
                      }}
                    />
                    <div className="nudge-buttons">
                      <button
                        className="nudge-button"
                        onClick={() => handleNudgeOut(-1)}
                        disabled={!clip}
                        title="-1 minute"
                      >
                        −1m
                      </button>
                      <button
                        className="nudge-button"
                        onClick={() => handleNudgeOut(1)}
                        disabled={!clip}
                        title="+1 minute"
                      >
                        +1m
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="properties-section">
              <h3 className="section-title">Export</h3>
              <div className="export-controls">
                <label className="export-preset-label">Preset</label>
                <select
                  className="export-preset-select"
                  value={exportPreset}
                  onChange={(e) => setExportPreset(e.target.value)}
                >
                  <option value="source">Source Quality</option>
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                </select>
              </div>
              <button
                className="export-button"
                onClick={onExport}
                disabled={!clip}
              >
                Export MP4
              </button>
            </div>
          </>
        )}

        {activeTab === "project" && (
          <div className="properties-section">
            <h3 className="section-title">Project Settings</h3>
            <div className="property-item">
              <span className="property-label">Title</span>
              {editingProjectTitle ? (
                <input
                  className="property-input"
                  type="text"
                  value={projectTitleValue}
                  onChange={(e) => setProjectTitleValue(e.target.value)}
                  onBlur={() => {
                    setEditingProjectTitle(false);
                    if (
                      projectId &&
                      onUpdateProjectTitle &&
                      projectTitleValue.trim()
                    ) {
                      onUpdateProjectTitle(projectId, projectTitleValue.trim());
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setEditingProjectTitle(false);
                      if (
                        projectId &&
                        onUpdateProjectTitle &&
                        projectTitleValue.trim()
                      ) {
                        onUpdateProjectTitle(
                          projectId,
                          projectTitleValue.trim()
                        );
                      }
                    } else if (e.key === "Escape") {
                      setEditingProjectTitle(false);
                      setProjectTitleValue(projectTitle || "");
                    }
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className="property-value property-value-editable"
                  onClick={() => setEditingProjectTitle(true)}
                  title="Click to edit"
                >
                  {projectTitle || "Untitled Project"}
                </span>
              )}
            </div>
            <div className="property-item">
              <span className="property-label">FPS</span>
              <span className="property-value">30</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertiesPanel;
