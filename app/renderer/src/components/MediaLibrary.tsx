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
  onRenameClip?: (clipId: string, newFilename: string) => void;
}

const MediaLibrary: React.FC<MediaLibraryProps> = ({
  clips,
  selectedClipId,
  onSelectClip,
  onImportClips,
  onRelinkMedia,
  onUpdateClipThumbnail,
  onRemoveClip,
  onRenameClip,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [renamingClipId, setRenamingClipId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");

  // Track which clips we've already processed to avoid re-running
  const processedClipsRef = React.useRef<Set<string>>(new Set());

  // Memoize clip IDs to prevent re-creating the string on every render
  const clipIds = React.useMemo(
    () => clips.map((c) => c.id).join(","),
    [clips]
  );

  // Store callback in ref to prevent it from triggering re-renders
  const updateThumbnailRef = React.useRef(onUpdateClipThumbnail);
  React.useEffect(() => {
    updateThumbnailRef.current = onUpdateClipThumbnail;
  }, [onUpdateClipThumbnail]);

  // Generate thumbnails for new clips
  React.useEffect(() => {
    const generateThumbnails = async () => {
      for (const clip of clips) {
        // Skip if we've already processed this clip
        if (processedClipsRef.current.has(clip.id)) {
          continue;
        }

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
            if (thumbPath && updateThumbnailRef.current) {
              const thumbnailUrl = `local-image://${thumbPath}`;
              updateThumbnailRef.current(clip.id, thumbnailUrl);
            }
            // Mark as processed after successful generation
            processedClipsRef.current.add(clip.id);
          } catch (error) {
            console.error(
              "[MediaLibrary] Failed to generate thumbnail:",
              error
            );
            // Still mark as processed to avoid infinite retries
            processedClipsRef.current.add(clip.id);
          }
        } else {
          // Has thumbnail, mark as processed
          processedClipsRef.current.add(clip.id);
        }
      }
    };

    generateThumbnails();
  }, [clipIds]); // Use memoized clipIds

  // Clean up processed clips when clips are removed
  React.useEffect(() => {
    const currentClipIds = new Set(clips.map((c) => c.id));
    const processedIds = Array.from(processedClipsRef.current);

    processedIds.forEach((id) => {
      if (!currentClipIds.has(id)) {
        processedClipsRef.current.delete(id);
      }
    });
  }, [clips.length]);

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

  const handleStartRename = (clipId: string) => {
    const clip = clips.find((c) => c.id === clipId);
    if (clip) {
      setRenamingClipId(clipId);
      setRenameValue(clip.filename);
    }
    handleContextMenuClose();
  };

  const handleRenameSubmit = (clipId: string) => {
    if (onRenameClip && renameValue.trim()) {
      onRenameClip(clipId, renameValue.trim());
    }
    setRenamingClipId(null);
    setRenameValue("");
  };

  const handleRenameCancel = () => {
    setRenamingClipId(null);
    setRenameValue("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, clipId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSubmit(clipId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleRenameCancel();
    }
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
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/clip-id", clip.id);
                    e.dataTransfer.setData("application/clip-path", clip.path);
                    e.dataTransfer.effectAllowed = "copy";
                    console.log(
                      "[MediaLibrary] Drag started for clip:",
                      clip.id
                    );
                  }}
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
                    {renamingClipId === clip.id ? (
                      <input
                        type="text"
                        className="clip-rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => handleRenameKeyDown(e, clip.id)}
                        onBlur={() => handleRenameSubmit(clip.id)}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
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
                    )}
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
            <button onClick={() => handleStartRename(contextMenuId)}>
              Rename
            </button>
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
