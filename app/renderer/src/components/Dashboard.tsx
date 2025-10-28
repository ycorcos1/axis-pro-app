/**
 * Dashboard Component
 * @mem ref: pr9-dashboard, design-spec-v2
 * Displays project cards grid with thumbnails and metadata
 */

import React, { useState, useEffect } from "react";
import "./Dashboard.css";

interface ProjectMetadata {
  id: string;
  title: string;
  updatedAt: number;
  stats?: {
    durationMs?: number;
    resolution?: string;
    clipCount?: number;
  };
  previewThumbPath?: string;
}

interface DashboardProps {
  onOpenProject: (projectId: string) => void;
  onNewProject: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  onOpenProject,
  onNewProject,
}) => {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const projectList = await window.electronAPI.listProjects();
      setProjects(projectList);
      console.log("[Dashboard] Loaded projects:", projectList.length);
    } catch (error) {
      console.error("[Dashboard] Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewProject = async () => {
    try {
      const project = await window.electronAPI.createProject(
        "Untitled Project"
      );
      console.log("[Dashboard] Created new project:", project.id);
      // Open the new project immediately
      onOpenProject(project.id);
    } catch (error) {
      console.error("[Dashboard] Failed to create project:", error);
    }
  };

  const handleOpen = (projectId: string) => {
    console.log("[Dashboard] Opening project:", projectId);
    onOpenProject(projectId);
  };

  const handleRenameStart = (project: ProjectMetadata) => {
    setEditingId(project.id);
    setEditingTitle(project.title);
    setMenuOpenId(null);
  };

  const handleRenameConfirm = async (projectId: string) => {
    if (editingTitle.trim() === "") {
      setEditingId(null);
      return;
    }

    try {
      await window.electronAPI.renameProject(projectId, editingTitle.trim());
      console.log("[Dashboard] Renamed project:", projectId);
      setEditingId(null);
      await loadProjects();
    } catch (error) {
      console.error("[Dashboard] Failed to rename project:", error);
      setEditingId(null);
    }
  };

  const handleRenameCancel = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const handleDuplicate = async (projectId: string) => {
    try {
      const newProject = await window.electronAPI.duplicateProject(projectId);
      console.log("[Dashboard] Duplicated project:", newProject.id);
      setMenuOpenId(null);
      await loadProjects();
    } catch (error) {
      console.error("[Dashboard] Failed to duplicate project:", error);
    }
  };

  const handleDelete = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    const confirmMsg = `Delete "${
      project?.title || "this project"
    }"? This cannot be undone.`;

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      await window.electronAPI.deleteProject(projectId);
      console.log("[Dashboard] Deleted project:", projectId);
      setMenuOpenId(null);
      await loadProjects();
    } catch (error) {
      console.error("[Dashboard] Failed to delete project:", error);
    }
  };

  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const formatDuration = (durationMs?: number): string => {
    if (!durationMs || durationMs === 0) return "0:00";
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const toggleMenu = (projectId: string) => {
    setMenuOpenId(menuOpenId === projectId ? null : projectId);
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-logo">
          <h1>Axis Pro</h1>
        </div>
        <div className="dashboard-actions">
          <button className="btn-primary" onClick={handleNewProject}>
            New Project
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        {loading ? (
          <div className="dashboard-loading">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="dashboard-empty">
            <div className="empty-card">
              <p>Create a project or import media to begin.</p>
              <button className="btn-primary" onClick={handleNewProject}>
                Create Your First Project
              </button>
            </div>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((project) => (
              <div
                key={project.id}
                className="project-card"
                onClick={() => handleOpen(project.id)}
              >
                <div className="project-thumbnail">
                  {project.previewThumbPath ? (
                    <img
                      src={`local-image://${project.previewThumbPath}`}
                      alt={project.title}
                      onLoad={() =>
                        console.log("[Dashboard] Thumbnail loaded:", project.id)
                      }
                      onError={(e) => {
                        console.error(
                          "[Dashboard] Thumbnail failed to load:",
                          project.id,
                          project.previewThumbPath
                        );
                        console.error("[Dashboard] Error:", e);
                      }}
                    />
                  ) : (
                    <div className="thumbnail-placeholder">
                      <span>No Preview</span>
                    </div>
                  )}
                </div>

                <div className="project-info">
                  {editingId === project.id ? (
                    <input
                      className="project-title-edit"
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleRenameConfirm(project.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameConfirm(project.id);
                        if (e.key === "Escape") handleRenameCancel();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <h3 className="project-title">{project.title}</h3>
                  )}

                  <div className="project-meta">
                    <span className="meta-item">
                      {formatRelativeTime(project.updatedAt)}
                    </span>
                    <span className="meta-separator">•</span>
                    <span className="meta-item">
                      {formatDuration(project.stats?.durationMs)}
                    </span>
                    <span className="meta-separator">•</span>
                    <span className="meta-item">
                      {project.stats?.clipCount || 0} clips
                    </span>
                    {project.stats?.resolution && (
                      <>
                        <span className="meta-separator">•</span>
                        <span className="meta-item meta-resolution">
                          {project.stats.resolution}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="project-actions">
                  <button
                    className="btn-menu"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMenu(project.id);
                    }}
                  >
                    ⋯
                  </button>

                  {menuOpenId === project.id && (
                    <div className="project-menu">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpen(project.id);
                        }}
                      >
                        Open
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRenameStart(project);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(project.id);
                        }}
                      >
                        Duplicate
                      </button>
                      <button
                        className="btn-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(project.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
