/**
 * MediaLibrary Component
 * @mem ref: design-spec, pr5-import
 * Left panel for displaying imported media files
 * Supports drag-and-drop and displays clip list with metadata
 */

import React, { useState } from "react";
import "./MediaLibrary.css";

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
  isMissing?: boolean;
}

interface MediaLibraryProps {
  clips: Clip[];
  selectedClipId: string | null;
  onSelectClip: (clipId: string) => void;
  onImportClips: (filePaths: string[]) => void;
  onRelinkMedia?: (clipId: string) => void;
  onUpdateClipThumbnail?: (clipId: string, thumbnailUrl: string) => void;
  onRemoveClip?: (clipId: string) => void;
}

const MediaLibrary: React.FC<MediaLibraryProps> = ({
  clips,
  selectedClipId,
  onSelectClip,
  onImportClips,
  onRelinkMedia,
  onUpdateClipThumbnail,
  onRemoveClip,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Generate thumbnails for new clips
  React.useEffect(() => {
    const generateThumbnails = async () => {
      console.log(
        "[MediaLibrary] Checking thumbnails for clips:",
        clips.length
      );
      for (const clip of clips) {
        if (!clip.thumbnailUrl) {
          console.log(
            "[MediaLibrary] Generating thumbnail for clip:",
            clip.id,
            clip.filename
          );
          try {
            const thumbPath = await window.electronAPI.generateClipThumbnail(
              clip.path,
              clip.id
            );
            console.log("[MediaLibrary] Thumbnail path received:", thumbPath);
            if (thumbPath && onUpdateClipThumbnail) {
              // Use local-image:// protocol for thumbnails
              const thumbnailUrl = `local-image://${thumbPath}`;
              console.log(
                "[MediaLibrary] Setting thumbnail URL:",
                thumbnailUrl
              );
              onUpdateClipThumbnail(clip.id, thumbnailUrl);
              console.log("[MediaLibrary] Thumbnail updated successfully");
            } else if (!thumbPath) {
              // Null thumbnail is expected for audio-only files
              console.log(
                "[MediaLibrary] No thumbnail generated for clip (likely audio-only):",
                clip.filename
              );
            }
          } catch (error) {
            console.error(
              "[MediaLibrary] Failed to generate thumbnail:",
              error
            );
          }
        } else {
          console.log("[MediaLibrary] Clip already has thumbnail:", clip.id);
        }
      }
    };

    generateThumbnails();
  }, [clips, onUpdateClipThumbnail]);

  /**
   * Format duration from milliseconds to MM:SS
   */
  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  /**
   * Handle drag over event
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging if there are files in the dataTransfer
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  /**
   * Handle drag leave event
   */
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  /**
   * Handle drop event
   */
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    console.log("[MediaLibrary] Drop event triggered");

    // Get file paths from dataTransfer.items using Electron's webUtils API
    const items = e.dataTransfer.items;
    const filePaths: string[] = [];

    console.log("[MediaLibrary] Processing", items.length, "dropped items");

    // Use getAsFile() and then webUtils.getPathForFile()
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          try {
            // Use Electron's webUtils API to get the file path
            const path = (window.electronAPI as any).getFilePath(file);
            console.log(
              "[MediaLibrary] Item",
              i,
              "- File:",
              file.name,
              "Path:",
              path
            );

            if (path) {
              filePaths.push(path);
            }
          } catch (error) {
            console.error("[MediaLibrary] Error getting file path:", error);
          }
        }
      }
    }

    console.log("[MediaLibrary] Extracted file paths:", filePaths);

    // Filter for video files
    const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
    const videoFiles = filePaths.filter(
      (path) =>
        path && videoExtensions.some((ext) => path.toLowerCase().endsWith(ext))
    );

    console.log("[MediaLibrary] Filtered video files:", videoFiles);

    if (videoFiles.length > 0) {
      console.log("[MediaLibrary] Calling onImportClips with:", videoFiles);
      await onImportClips(videoFiles);
    } else {
      console.log("[MediaLibrary] No video files found in dropped files");
    }
  };

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent, clipId: string) => {
    e.preventDefault();
    setContextMenuId(clipId);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const handleContextMenuClose = () => {
    setContextMenuId(null);
    setContextMenuPosition(null);
  };

  // Handle context menu actions
  const handleRevealInFinder = async (clipId: string) => {
    const clip = clips.find((c) => c.id === clipId);
    if (clip) {
      // TODO: Implement reveal in finder
      console.log("[MediaLibrary] Reveal in Finder:", clip.path);
    }
    handleContextMenuClose();
  };

  const handleRemoveFromProject = (clipId: string) => {
    if (onRemoveClip) {
      onRemoveClip(clipId);
    }
    console.log("[MediaLibrary] Remove from project:", clipId);
    handleContextMenuClose();
  };

  const handleRelink = async (clipId: string) => {
    if (onRelinkMedia) {
      await onRelinkMedia(clipId);
    }
    handleContextMenuClose();
  };

  return (
    <div className="media-library">
      <div className="panel-header">
        <h2 className="panel-title">Media Library</h2>
        <div className="media-library-controls">
          <button
            className={`view-toggle ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
            title="List view"
          >
            ≡
          </button>
          <button
            className={`view-toggle ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
            title="Grid view"
          >
            ⊞
          </button>
        </div>
      </div>

      <div
        className={`media-library-content ${isDragging ? "dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {clips.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📁</div>
            <p className="empty-state-text">Drop a clip to begin</p>
            <p className="empty-state-hint">or click Import</p>
          </div>
        ) : (
          <div
            className={`clip-list ${
              viewMode === "grid" ? "clip-list-grid" : ""
            }`}
          >
            {clips.map((clip) => {
              console.log(
                "[MediaLibrary] Rendering clip:",
                clip.id,
                "thumbnailUrl:",
                clip.thumbnailUrl
              );
              return (
                <div
                  key={clip.id}
                  className={`clip-card ${
                    selectedClipId === clip.id ? "selected" : ""
                  }`}
                  onClick={() => onSelectClip(clip.id)}
                  onContextMenu={(e) => handleContextMenu(e, clip.id)}
                  onDragOver={(e) => e.stopPropagation()}
                  onDrop={(e) => e.stopPropagation()}
                >
                  <div className="clip-thumbnail">
                    {clip.thumbnailUrl ? (
                      <img
                        src={clip.thumbnailUrl}
                        alt={clip.filename}
                        className="clip-thumbnail-image"
                        onLoad={() =>
                          console.log(
                            "[MediaLibrary] Thumbnail loaded:",
                            clip.id
                          )
                        }
                        onError={(e) => {
                          console.error(
                            "[MediaLibrary] Thumbnail failed to load:",
                            clip.id,
                            clip.thumbnailUrl
                          );
                          console.error("[MediaLibrary] Error:", e);
                        }}
                      />
                    ) : (
                      <div className="clip-thumbnail-placeholder">🎬</div>
                    )}
                  </div>
                  <div className="clip-info">
                    <div className="clip-filename" title={clip.filename}>
                      {clip.filename}
                      {clip.isMissing && (
                        <span
                          className="clip-missing-badge"
                          title="Media file not found"
                        >
                          ⚠️
                        </span>
                      )}
                    </div>
                    <div className="clip-metadata">
                      <span className="clip-duration">
                        {formatDuration(clip.duration)}
                      </span>
                      <span className="clip-resolution">
                        {clip.width}×{clip.height}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenuId && contextMenuPosition && (
        <>
          <div
            className="context-menu-overlay"
            onClick={handleContextMenuClose}
          />
          <div
            className="context-menu"
            style={{
              left: `${contextMenuPosition.x}px`,
              top: `${contextMenuPosition.y}px`,
            }}
          >
            {clips.find((c) => c.id === contextMenuId)?.isMissing && (
              <button onClick={() => handleRelink(contextMenuId)}>
                Relink Media
              </button>
            )}
            <button onClick={() => handleRevealInFinder(contextMenuId)}>
              Reveal in Finder
            </button>
            <button onClick={() => handleRemoveFromProject(contextMenuId)}>
              Remove from Project
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default MediaLibrary;
