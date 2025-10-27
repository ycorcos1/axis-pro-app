# Axis Pro — Comprehensive MVP Task List

## 🧰 Manual Setup Checklist (Do This First)

Perform these steps **before** giving Cursor the PRD, Design Spec, and Task List.

1. **Create Folder**

   - Create an empty folder on Desktop named `axis-pro`.

2. **Install Dependencies**

   - Install Node.js LTS (includes npm).

3. **Create GitHub Repo**

   - Initialize or clone a GitHub repo named `axis-pro`.
   - Connect via GitHub Desktop.

4. **FFmpeg Binary**

   - Download static FFmpeg binary for macOS.
   - Place it at: `resources/ffmpeg/mac/ffmpeg`.
   - Run: `chmod +x resources/ffmpeg/mac/ffmpeg`.

5. **Add Docs**

   - Place the following in `/docs/`:
     - `Axis_Pro_MVP_PRD.md`
     - `Axis_Pro_Design_Specification_Sheet.md`
     - `memory-bank.json` (content: `{ "version":"0.1.0" }`)

6. **Commit & Push**
   - Push this setup to GitHub.
   - You’re ready to start PR #1.

---

## 🧩 Task List for Cursor Implementation (Each PR = New Chat)

Each PR is independent. Cursor will implement the feature, update `memory-bank.json`, and open a PR.

---

### **PR 1 — Initialize Electron + React app skeleton**

**Branch:** `feature/init-electron-react`  
**Objective:** Scaffold base Electron + React app.

**Tasks:**

- Initialize Electron + React (TypeScript) with secure preload.
- Create base folders: `main`, `preload`, `renderer`.
- Add npm scripts: `dev`, `build`, `pack:mac`.
- Install dependencies (`electron`, `react`, `typescript`, `vite`, `electron-builder`).
- Launch blank window titled "Axis Pro".

**Verify:**

- Run `npm run dev` — window opens successfully.

---

### **PR 2 — Design tokens, base theme, and layout frame**

**Branch:** `feature/ui-shell-and-theme`  
**Objective:** Create the main UI frame per design spec.

**Tasks:**

- Implement color, font, and radius tokens.
- Layout: TopBar, Left Library, Center Preview, Bottom Timeline, Right Properties.
- Apply transitions ≤200ms.

**Verify:**

- App loads with all panels visible and styled.

---

### **PR 3 — IPC Surface (secure)**

**Branch:** `feature/ipc-surface`  
**Objective:** Expose secure APIs between main and renderer.

**Tasks:**

- Add preload with contextBridge for:
  - `selectFiles()`
  - `probe(path)`
  - `importClips(paths)`
  - `exportTimeline(segment, path)`
- Main process: wire ipc handlers for file dialogs.

**Verify:**

- Console logs selected file paths when calling `selectFiles()`.

---

### **PR 4 — FFmpeg Service (probe + trim/export)**

**Branch:** `feature/ffmpeg-service`  
**Objective:** Add core video processing module.

**Tasks:**

- Add `ffmpegService` with `probe` and `trimExport`.
- Handle macOS path via `process.resourcesPath`.
- Use `-c copy` for fast trim; fallback to re-encode.

**Verify:**

- Running `probe()` returns clip metadata.

---

### **PR 5 — Media Import + Library View**

**Branch:** `feature/import-and-library`  
**Objective:** Implement file import and display list.

**Tasks:**

- Drag/drop and file picker for MP4/MOV.
- Store imported clips with duration/resolution.
- Render Library list.

**Verify:**

- Imported clips appear with filename and duration.

---

### **PR 6 — Timeline Track + Trim Handles**

**Branch:** `feature/timeline-single-track`  
**Objective:** Enable timeline trimming logic.

**Tasks:**

- Display single track with imported clips.
- Add in/out handles for trim adjustments.
- Update state on handle movement.

**Verify:**

- Trimming updates clip in/out data correctly.

---

### **PR 7 — Preview Player**

**Branch:** `feature/preview-player`  
**Objective:** Add playback and scrubbing support.

**Tasks:**

- Create HTML5 video player respecting `inMs`/`outMs`.
- Spacebar toggles play/pause.
- Scrubber seeks inside trimmed region.

**Verify:**

- Video plays and stops within trim bounds.

---

### **PR 8 — Export MP4**

**Branch:** `feature/export-mp4`  
**Objective:** Allow saving trimmed video to disk.

**Tasks:**

- File save dialog → call `trimExport()`.
- Show progress indicator.
- Verify file exists and is playable.

**Verify:**

- Exported file matches trim selection.

---

### **PR 9 — Packaging for macOS (.dmg) + README**

**Branch:** `feature/packaging-mac`  
**Objective:** Produce distributable `.dmg` file.

**Tasks:**

- Configure `electron-builder.yml`.
- Include FFmpeg under `extraResources`.
- Add build instructions in README.

**Verify:**

- `npm run build && npm run pack:mac` → generates `.dmg`.
- App runs outside dev mode.

---

### **PR 10 — UX Polish (keyboard shortcuts, animations)**

**Branch:** `feature/ux-polish`  
**Objective:** Finalize minimal aesthetic.

**Tasks:**

- Add hover and selection effects.
- Add keyboard shortcuts: Space, ⌘/Ctrl+I, ⌘/Ctrl+E.
- Refine padding, typography, colors.

**Verify:**

- UI matches “Pro-Studio Minimalist” behavior.

---

### **PR 11 — Project Save/Load**

**Branch:** `feature/project-save-load`  
**Objective:** Save and restore session state.

**Tasks:**

- Save state (clips, trims) to `axisproj.json`.
- Load and restore previous state.

**Verify:**

- Project reloads successfully after restart.

---

### **PR 12 — Submission Packaging + GitHub Release**

**Branch:** `feature/submission-prep`  
**Objective:** Prepare for final delivery.

**Tasks:**

- Add script alias: `npm run package:mac`.
- Create README submission section with GitHub Release upload steps.
- Optional: Add CHANGELOG.md (v0.1.0).

**Verify:**

- `.dmg` built and uploaded manually via GitHub Release.

---

## 🧠 Post-MVP (Optional)

- Add Windows build support (NSIS).
- Multi-track timeline.
- Screen/webcam recording (future phase).
- Export presets and transitions.
