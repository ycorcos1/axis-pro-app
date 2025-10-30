/**
 * Overlay Inspector Component
 * @mem ref: pr16-text-overlays
 * Panel for editing text overlay properties
 */

import React, { useState, useEffect } from "react";
import type { Overlay } from "../../../shared/timelineTypes";
import "./OverlayInspector.css";

interface OverlayInspectorProps {
  overlay: Overlay | null;
  onUpdateOverlay: (overlayId: string, updates: Partial<Overlay>) => void;
  onDeleteOverlay: (overlayId: string) => void;
}

const OverlayInspector: React.FC<OverlayInspectorProps> = ({
  overlay,
  onUpdateOverlay,
  onDeleteOverlay,
}) => {
  const [content, setContent] = useState("");
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontWeight, setFontWeight] = useState(700);
  const [fillColor, setFillColor] = useState("#FFFFFF");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [anchorPoint, setAnchorPoint] = useState<
    "center" | "tl" | "tc" | "tr" | "bl" | "bc" | "br"
  >("center");
  const [posX, setPosX] = useState(0.5);
  const [posY, setPosY] = useState(0.85);
  const [animationIn, setAnimationIn] = useState<
    "none" | "fade" | "fadeUp" | "fadeDown"
  >("fadeUp");
  const [animationOut, setAnimationOut] = useState<
    "none" | "fade" | "fadeUp" | "fadeDown"
  >("fade");

  // Sync local state with overlay prop
  useEffect(() => {
    if (overlay) {
      setContent(overlay.content);
      setFontSize(overlay.font.size);
      setFontFamily(overlay.font.family);
      setFontWeight(overlay.font.weight || 700);
      setFillColor(overlay.fill);
      setStrokeColor(overlay.stroke?.color || "#000000");
      setStrokeWidth(overlay.stroke?.width || 2);
      setAnchorPoint(overlay.bounds.anchor);
      setPosX(overlay.bounds.x);
      setPosY(overlay.bounds.y);
      setAnimationIn(overlay.animation?.in?.type || "fadeUp");
      setAnimationOut(overlay.animation?.out?.type || "fade");
    }
  }, [overlay]);

  if (!overlay) {
    return (
      <div className="overlay-inspector">
        <div className="inspector-header">
          <h3 className="inspector-title">Text Overlay</h3>
        </div>
        <div className="inspector-content">
          <p className="inspector-placeholder">No overlay selected</p>
        </div>
      </div>
    );
  }

  const handleUpdate = (updates: Partial<Overlay>) => {
    onUpdateOverlay(overlay.id, updates);
  };

  const formatTimecode = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="overlay-inspector">
      <div className="inspector-header">
        <h3 className="inspector-title">Text Overlay</h3>
        <button
          className="inspector-delete-button"
          onClick={() => onDeleteOverlay(overlay.id)}
          title="Delete overlay"
        >
          Delete
        </button>
      </div>

      <div className="inspector-content">
        {/* Text Content */}
        <div className="inspector-section">
          <label className="inspector-label">Content</label>
          <textarea
            className="inspector-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={() => handleUpdate({ content })}
            rows={3}
            placeholder="Enter text..."
          />
        </div>

        {/* Timing */}
        <div className="inspector-section">
          <h4 className="inspector-section-title">Timing</h4>
          <div className="inspector-row">
            <label className="inspector-label">Start</label>
            <span className="inspector-value">
              {formatTimecode(overlay.startMs)}
            </span>
          </div>
          <div className="inspector-row">
            <label className="inspector-label">Duration</label>
            <input
              type="number"
              className="inspector-input"
              value={Math.round(overlay.durationMs / 1000)}
              onChange={(e) => {
                const durationSec = parseInt(e.target.value) || 1;
                handleUpdate({ durationMs: durationSec * 1000 });
              }}
              min={1}
              step={1}
            />
            <span className="inspector-unit">sec</span>
          </div>
        </div>

        {/* Font */}
        <div className="inspector-section">
          <h4 className="inspector-section-title">Font</h4>
          <div className="inspector-row">
            <label className="inspector-label">Family</label>
            <select
              className="inspector-select"
              value={fontFamily}
              onChange={(e) => {
                setFontFamily(e.target.value);
                handleUpdate({
                  font: { ...overlay.font, family: e.target.value },
                });
              }}
            >
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Georgia">Georgia</option>
              <option value="Courier New">Courier New</option>
              <option value="Verdana">Verdana</option>
              <option value="Impact">Impact</option>
            </select>
          </div>
          <div className="inspector-row">
            <label className="inspector-label">Size</label>
            <input
              type="number"
              className="inspector-input"
              value={fontSize}
              onChange={(e) => {
                const size = parseInt(e.target.value) || 12;
                setFontSize(size);
                handleUpdate({ font: { ...overlay.font, size } });
              }}
              min={8}
              max={200}
              step={1}
            />
            <span className="inspector-unit">px</span>
          </div>
          <div className="inspector-row">
            <label className="inspector-label">Weight</label>
            <select
              className="inspector-select"
              value={fontWeight}
              onChange={(e) => {
                const weight = parseInt(e.target.value);
                setFontWeight(weight);
                handleUpdate({
                  font: { ...overlay.font, weight },
                });
              }}
            >
              <option value="400">Normal (400)</option>
              <option value="700">Bold (700)</option>
              <option value="900">Black (900)</option>
            </select>
          </div>
        </div>

        {/* Colors */}
        <div className="inspector-section">
          <h4 className="inspector-section-title">Colors</h4>
          <div className="inspector-row">
            <label className="inspector-label">Fill</label>
            <input
              type="color"
              className="inspector-color"
              value={fillColor}
              onChange={(e) => {
                setFillColor(e.target.value);
                handleUpdate({ fill: e.target.value });
              }}
            />
            <input
              type="text"
              className="inspector-input inspector-input-small"
              value={fillColor}
              onChange={(e) => {
                setFillColor(e.target.value);
                handleUpdate({ fill: e.target.value });
              }}
            />
          </div>
          <div className="inspector-row">
            <label className="inspector-label">Stroke</label>
            <input
              type="color"
              className="inspector-color"
              value={strokeColor}
              onChange={(e) => {
                setStrokeColor(e.target.value);
                handleUpdate({
                  stroke: {
                    ...overlay.stroke,
                    color: e.target.value,
                    width: strokeWidth,
                  },
                });
              }}
            />
            <input
              type="number"
              className="inspector-input inspector-input-small"
              value={strokeWidth}
              onChange={(e) => {
                const width = parseInt(e.target.value) || 0;
                setStrokeWidth(width);
                handleUpdate({
                  stroke: {
                    ...overlay.stroke,
                    color: strokeColor,
                    width,
                  },
                });
              }}
              min={0}
              max={20}
              step={1}
            />
            <span className="inspector-unit">px</span>
          </div>
        </div>

        {/* Position */}
        <div className="inspector-section">
          <h4 className="inspector-section-title">Position</h4>
          <div className="inspector-row">
            <label className="inspector-label">Anchor</label>
            <select
              className="inspector-select"
              value={anchorPoint}
              onChange={(e) => {
                const anchor = e.target.value as typeof anchorPoint;
                setAnchorPoint(anchor);
                handleUpdate({
                  bounds: { ...overlay.bounds, anchor },
                });
              }}
            >
              <option value="tl">Top Left</option>
              <option value="tc">Top Center</option>
              <option value="tr">Top Right</option>
              <option value="center">Center</option>
              <option value="bl">Bottom Left</option>
              <option value="bc">Bottom Center</option>
              <option value="br">Bottom Right</option>
            </select>
          </div>
          <div className="inspector-row">
            <label className="inspector-label">X</label>
            <input
              type="range"
              className="inspector-range"
              value={posX}
              onChange={(e) => {
                const x = parseFloat(e.target.value);
                setPosX(x);
                handleUpdate({
                  bounds: { ...overlay.bounds, x },
                });
              }}
              min={0}
              max={1}
              step={0.01}
            />
            <span className="inspector-value-small">
              {Math.round(posX * 100)}%
            </span>
          </div>
          <div className="inspector-row">
            <label className="inspector-label">Y</label>
            <input
              type="range"
              className="inspector-range"
              value={posY}
              onChange={(e) => {
                const y = parseFloat(e.target.value);
                setPosY(y);
                handleUpdate({
                  bounds: { ...overlay.bounds, y },
                });
              }}
              min={0}
              max={1}
              step={0.01}
            />
            <span className="inspector-value-small">
              {Math.round(posY * 100)}%
            </span>
          </div>
        </div>

        {/* Animation */}
        <div className="inspector-section">
          <h4 className="inspector-section-title">Animation</h4>
          <div className="inspector-row">
            <label className="inspector-label">In</label>
            <select
              className="inspector-select"
              value={animationIn}
              onChange={(e) => {
                const type = e.target.value as typeof animationIn;
                setAnimationIn(type);
                const animation =
                  type === "none"
                    ? { ...overlay.animation, in: undefined }
                    : {
                        ...overlay.animation,
                        in: { type, durationMs: 300 },
                      };
                handleUpdate({ animation });
              }}
            >
              <option value="none">None</option>
              <option value="fade">Fade</option>
              <option value="fadeUp">Fade Up</option>
              <option value="fadeDown">Fade Down</option>
            </select>
          </div>
          <div className="inspector-row">
            <label className="inspector-label">Out</label>
            <select
              className="inspector-select"
              value={animationOut}
              onChange={(e) => {
                const type = e.target.value as typeof animationOut;
                setAnimationOut(type);
                const animation =
                  type === "none"
                    ? { ...overlay.animation, out: undefined }
                    : {
                        ...overlay.animation,
                        out: { type, durationMs: 300 },
                      };
                handleUpdate({ animation });
              }}
            >
              <option value="none">None</option>
              <option value="fade">Fade</option>
              <option value="fadeUp">Fade Up</option>
              <option value="fadeDown">Fade Down</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverlayInspector;
