# Axis Pro — MVP Task List (v2, PR #1–8 complete)

> Continue from your current progress. This plan assumes PR #1–8 are merged.

## PR 9 — Dashboard (projects grid with thumbnails & metadata)

**Branch:** `feature/dashboard`  
**Objective:** Implement recent‑projects view.

**Tasks**

- File system: ensure `~/AxisPro/projects/` exists.
- `projectIO`: read directories; parse `project.json`; sort by `updatedAt`.
- `thumbService`: generate `thumb.jpg` (ffmpeg first non‑black frame) when missing.
- React: Dashboard route `/dashboard`, grid cards (thumbnail, title, last edited, duration, res).
- Actions: Open, Rename (inline), Duplicate, Delete → confirm & move to trash.
- “New Project” button → create folder + `project.json` skeleton and route to editor.

**Verify**

- Cards render from real dirs; New Project creates a new entry; Open loads correctly.

## PR 10 — Editing Screen overhaul (timeline + clips board UX)

**Branch:** `feature/editing-overhaul`  
**Objective:** Bring timeline/clipboard to standard NLE conventions.

**Tasks**

- Library: grid/list toggle, thumbnails, durations; right‑click menu.
- Timeline: clip thumbnails strip, snap to playhead/edges, zoom slider, ruler with timecode.
- Handles: glow on hover; keyboard nudge (±1f/±5f).
- Properties: Clip/Project tabs; in/out numeric fields with nudge; export preset dropdown.
- Toast system for success/warn/error; subtle focus rings per active region.

**Verify**

- Drag from Library to timeline shows snap; trim reflects in preview; preset shows in export dialog.

## PR 11 — Project persistence (save/load + relink)

**Branch:** `feature/project-save-load`  
**Objective:** Make project state durable and restore‑able.

**Tasks**

- Save: write `project.json` with clips/segments; update `updatedAt` and `stats`.
- Load: hydrate state; if media path missing, badge clip and provide “Relink” (file picker).
- Thumbnail: refresh `thumb.jpg` on save if none; cap to 960x540 for perf.
- Dashboard: after save, project appears/updates in grid.

**Verify**

- Close app → reopen → open project from Dashboard → state restored; relink flow works.

## PR 12 — Packaging + Distribution

**Branch:** `feature/packaging-and-dist`  
**Objective:** Produce `.dmg` and document download link workflow.

**Tasks**

- Confirm `electron-builder.yml` includes ffmpeg under `extraResources`.
- Add `npm run package:mac`.
- README: install + build + **GitHub Releases**

**Verify**

- `.dmg` built; installs and runs outside dev; README instructions are clear.
