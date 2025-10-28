# Axis Pro — Design Specification Sheet (v2)

> Theme: **Pro‑Studio Minimalist** — calm, focused, native-feeling. Blue accent. High contrast, low chrome.

## 1) Global Visual System
- **Color**  
  - Background tiers: Workspace `#111214`, Preview `#141518`, Panels `#1A1B1E`, Timeline `#0F1012`  
  - Text: Primary `#F4F6F8`, Secondary `#B9BFC7`, Muted `#8A9099`  
  - Accents: Brand Blue `#2388FF`, Selection Outline `rgba(35,136,255,0.6)`
- **Type**  
  - System (SF Pro / Segoe UI). Headings 600, body 400. Small caps for section headers.
- **Motion**  
  - 120–180ms ease, no bounces. Hover/active scale 0.98–1.0 max.
- **Iconography**  
  - Feather/lucide style, 1.5px stroke, low saturation.

## 2) Application Shell
- **Top Bar** (left→right): App logo, Project name ▼, File, Edit, View, Import, Export, Help.  
- **Panels**: Left **Media Library**, Center **Preview**, Right **Properties**, Bottom **Timeline**.

---

## 3) NEW — Dashboard Screen
Purpose: quick access to **Recent Projects** with thumbnails + metadata.

### 3.1 Layout
- **Header**: App logo + “Axis Pro” + **New Project** (primary button), **Open…**
- **Grid**: 2–4 columns responsive cards (min 320px).  
- **Project Card** contents:
  - **Thumbnail**: 16:9 image (first usable frame or saved preview) with soft 8px radius.
  - **Title** (editable), **Last edited** (relative), **Duration**, **Clips**, **Resolution tag** (e.g., 1080p).
  - **Actions** on hover: Open, Rename, Duplicate, Delete (⋯ menu).
- **Empty state**: ghost card with hint “Create a project or import media to begin.”

### 3.2 Data & Thumbnails
- Project files live under `~/AxisPro/projects/<projectId>/`
  - `project.json` (state), `thumb.jpg` (960x540), `media/` (optional copies or links)
- Thumbnails generated via ffmpeg: first non‑black frame or user-marked preview.
- Cards read from `/projects/` on launch (sorted by `updatedAt`).

### 3.3 Interactions
- ⌘N New Project → goes to Editing Screen with empty timeline.  
- Open recent → loads state, routes to Editing Screen.  
- Delete asks confirmation (non‐blocking toast).

---

## 4) Editing Screen (refined)
Standard NLE conventions; faster “clips board” usability.

### 4.1 Regions
- **Left: Media Library**
  - Drag‑drop zone; list/grid toggle.
  - Each item: thumbnail + name + duration; right‑click “Reveal in Finder”, “Remove from project”.
- **Center: Preview**
  - 16:9 canvas with letterbox; transport controls: <<, ▶/⏸, >>, timecode, volume.
  - Overlay tips when empty: “Drop or Import a clip”.
- **Right: Properties**
  - Tabs: **Clip** | **Project**
  - Clip panel: duration, resolution, FPS, path; in/out readouts with nudge buttons (±1f, ±5f).
  - Project panel: project title, fps/base timecode, export preset.
- **Bottom: Timeline**
  - **Tracks**: V1 (video+audio linked). (Audio track UI deferred.)
  - **Clips**: rounded rectangles with thumbnail strip + waveform mini (when space allows).
  - **Handles**: in/out grips; hover glow; snap to playhead/other clip edges.
  - **Playhead** with time ruler; zoom slider (25%–400%).
  - **Context menu**: Split at playhead, Ripple delete (MVP optional), Set in/out from selection.
  - **Keyboard**: Space play/pause; JKL shuttle; ⌘/Ctrl + I/E Import/Export; S split (optional).

### 4.2 Empty & Error States
- Empty timeline hint centered.
- If media path missing, show warning badge on clip; Properties offers “Relink”.

### 4.3 Export
- Button in Properties > Export section. Preset dropdown (Source, 1080p, 720p). Progress inline.

---

## 5) Micro‑interactions & Feedback
- Subtle shadows to separate panels; focus ring when region active.  
- Toasts bottom‑right (success, warning, error).  
- Dragging clip shows ghost with length; snapping emits soft tick sound (optional).

---

## 6) Accessibility
- Minimum 4.5:1 text contrast; 8px targets for handles; keyboard reachability on all controls.  
- Tooltips for all icons with shortcuts.

---

## 7) Non‑Goals (MVP)
- No YouTube/Rumble link ingestion UI.  
- No cloud projects.  
- No multi‑track editing yet (future).

---

## 8) Preview Assets (optional)
- Placeholder SVGs for empty states.  
- Default project thumbnail if none created.
