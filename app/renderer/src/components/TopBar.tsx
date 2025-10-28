/**
 * TopBar Component
 * @mem ref: design-spec, ipc-surface, pr5-import, pr8-export, pr9-dashboard
 * Main navigation and menu bar per Axis Pro layout
 */

import React, { useState } from "react";
import "./TopBar.css";

interface TopBarProps {
  onImportClick?: () => void;
  onExportClick?: () => void;
  isExporting?: boolean;
  exportDisabled?: boolean;
  onBackToDashboard?: () => void;
  projectId?: string | null;
  onSaveClick?: () => void;
  isSaving?: boolean;
  lastSaved?: number | null;
  onNewProject?: () => void;
  onOpenProject?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  onImportClick,
  onExportClick,
  isExporting = false,
  exportDisabled = false,
  onBackToDashboard,
  projectId,
  onSaveClick,
  isSaving = false,
  lastSaved = null,
  onNewProject,
  onOpenProject,
}) => {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);

  const formatLastSaved = (timestamp: number | null): string => {
    if (!timestamp) return "";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `Saved ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `Saved ${minutes}m ago`;
  };

  return (
    <div className="topbar">
      <div className="topbar-brand">
        {onBackToDashboard && (
          <button className="topbar-back-btn" onClick={onBackToDashboard}>
            ← Dashboard
          </button>
        )}
        <span className="topbar-logo">A</span>
        <span className="topbar-title">Axis Pro</span>
        {projectId && <span className="topbar-project-id">• {projectId}</span>}
        {lastSaved && (
          <span className="topbar-save-status">
            {formatLastSaved(lastSaved)}
          </span>
        )}
      </div>

      <div className="topbar-menu">
        <div className="topbar-menu-dropdown">
          <button
            className="topbar-menu-item"
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
          >
            File
          </button>
          {fileMenuOpen && (
            <>
              <div
                className="topbar-menu-overlay"
                onClick={() => setFileMenuOpen(false)}
              />
              <div className="topbar-menu-dropdown-content">
                {onNewProject && (
                  <button
                    className="topbar-menu-dropdown-item"
                    onClick={() => {
                      setFileMenuOpen(false);
                      onNewProject();
                    }}
                  >
                    New Project (⌘N)
                  </button>
                )}
                {onOpenProject && (
                  <button
                    className="topbar-menu-dropdown-item"
                    onClick={() => {
                      setFileMenuOpen(false);
                      onOpenProject();
                    }}
                  >
                    Open Project...
                  </button>
                )}
                {onImportClick && (
                  <button
                    className="topbar-menu-dropdown-item"
                    onClick={() => {
                      setFileMenuOpen(false);
                      onImportClick();
                    }}
                  >
                    Import... (⌘I)
                  </button>
                )}
                {onSaveClick && (
                  <button
                    className="topbar-menu-dropdown-item"
                    onClick={() => {
                      setFileMenuOpen(false);
                      onSaveClick();
                    }}
                    disabled={isSaving || !projectId}
                  >
                    {isSaving ? "Saving..." : "Save (⌘S)"}
                  </button>
                )}
                <div className="topbar-menu-divider" />
                {onExportClick && (
                  <button
                    className="topbar-menu-dropdown-item"
                    onClick={() => {
                      setFileMenuOpen(false);
                      onExportClick();
                    }}
                    disabled={exportDisabled || isExporting || !projectId}
                  >
                    {isExporting ? "Exporting..." : "Export... (⌘E)"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
