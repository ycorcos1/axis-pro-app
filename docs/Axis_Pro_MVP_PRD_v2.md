# Axis Pro — MVP Product Requirement Document (v2)

> Scope: MVP with **Dashboard** (projects grid) and **Editing Screen** refinements. AI Agent features are **deferred** to Final Phase; they appear here only as future work pointers.

## 1. Objective
Deliver a packaged macOS desktop editor demonstrating import → timeline → preview → trim → export, plus:
- **Dashboard** listing previous projects with thumbnail + metadata.
- **Editing Screen** with improved clips board (standard NLE conventions).

## 2. Architecture
- **Framework**: Electron + React + TypeScript.
- **Media**: local ffmpeg/ffprobe invoked from main process via `child_process.spawn`.
- **State**: project JSON saved under `~/AxisPro/projects/<projectId>/project.json`.
- **Thumbnails**: ffmpeg-generated `thumb.jpg` saved alongside project.
- **IPC**: secure `contextBridge` exposing file dialogs, ffmpeg operations, project IO.

## 3. Data Model (MVP)
```ts
type Project = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  fps: number; // base timeline fps
  clips: Record<string, Clip>;
  segments: Segment[]; // V1 single track
  previewThumbPath?: string;
  stats?: { durationMs?: number; resolution?: string };
};

type Clip = {
  id: string;
  path: string; // absolute
  durationMs: number;
  width: number;
  height: number;
  fps?: number;
  audioChannels?: number;
};

type Segment = {
  id: string;
  clipId: string;
  inMs: number;
  outMs: number;
  startMs: number; // position on timeline
};
```

## 4. Features & Acceptance Criteria

### 4.1 Dashboard (NEW)
**User story**: As a user, I see my recent projects with thumbnails and metadata and can open or create projects quickly.

- Reads directories under `~/AxisPro/projects/` and renders cards.  
- Each card shows thumbnail, title, last edited, duration, resolution tag.  
- Actions: Open, Rename (inline), Duplicate (copy dir), Delete (move to trash).  
- **Create New Project** → new id, empty timeline, route to Editing Screen.  
**Acceptance**: Grid renders from real data; open/rename/delete works; new project routes and saves.

### 4.2 Editing Screen (Refined)
- Library grid/list with thumbnails + durations; drag to timeline.  
- Timeline with thumbnails on clips, snap, zoom slider, playhead + ruler.  
- Properties panel with Clip and Project tabs; in/out numeric nudge.  
- Export MP4 with preset dropdown; progress + success toast.  
**Acceptance**: Trim reflects in preview; export produces correct MP4; UI interactions match spec.

### 4.3 Save/Load (Project Persistence)
- `Save Project` writes `project.json` and updates `thumb.jpg` (via ffmpeg first-good-frame).  
- `Open Project` hydrates state; missing files are flagged with “Relink”.  
- Auto-update `updatedAt` for Dashboard ordering.  
**Acceptance**: Close and reopen app, open a project, and all state is restored.

## 5. Setup & Packaging
- Dev: `npm run dev`
- Build: `npm run build`
- Package macOS: `npm run pack:mac` → `.dmg`
- **Distribution**: host `.dmg` on Google Drive/Dropbox; include link in README.

## 6. Memory Bank Expectations
- Record module contracts (`dashboardService`, `projectIO`, `thumbService`).  
- Log any deviations (e.g., alternative ffmpeg flags) and known gotchas (paths, permissions).

## 7. Risks
- Thumbnail generation performance on large media → cap seek depth, use `-vf thumbnail,scale=960:-1`.  
- Broken media paths after moving files → provide “Relink” UX.  
- macOS sandbox/codesign not required for grading; notarization out of scope.

## 8. Future (Final Phase) — AI Agent Pointers
- **Auto‑Clipping**: silence/scene detection to propose shorts/highlights.  
- **Auto‑Captioning**: ASR to SRT/VTT + styled captions.  
- **Co‑Editor Chat**: natural language edit commands.  
- **B‑roll Filler** and **Tone Matching**.
