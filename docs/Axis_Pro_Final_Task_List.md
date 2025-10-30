# Axis Pro — Final Phase Task List

**Version:** 1.0  
**Scope:** Recording Suite, Advanced Timeline, Undo/Redo, AI Captioning, Packaging  
**Stack:** Electron + React + FFmpeg + OpenAI API

---

## PR 13 — Recording Suite (Screen, Webcam, Mic, PiP)

**Branch:** `feature/recording-suite`  
**Goal:** Allow full screen or window capture with optional webcam (PiP) and microphone input.

### Tasks

- [ ] Add `recordingService.ts` using Electron `desktopCapturer` + `getUserMedia`.
- [ ] Implement recording panel (HUD) in React: Screen/Window selector, Webcam & Mic toggles, Start/Stop buttons.
- [ ] Save recordings to `~/AxisPro/projects/<id>/recordings/`.
- [ ] On stop, create Clip + Segment at playhead.
- [ ] Use FFmpeg to remux `.webm` → `.mp4` if needed.

### Verify

- Recording start/stop works.
- Webcam PiP visible.
- Audio recorded.
- File saved and playable.

---

## PR 14 — Advanced Timeline (Multi-Track, Snapping, Zoom) ✅

**Branch:** `feature/recording-suite` (integrated)  
**Goal:** Implement full multi-track editor, snapping, split, delete, and zoom.  
**Status:** COMPLETED

### Tasks

- [x] Extend timeline for multiple tracks (main + overlay).
- [x] Implement split at playhead, trim handles, and delete.
- [x] Add zoom slider (25–400%).
- [x] Add snap-to-grid and snap-to-clip edges toggle.
- [x] Render stacked tracks; overlay above main.
- [x] Implement drag-and-drop from Media Library to timeline.
- [x] Add project save/load for new timeline format.
- [x] Integrate ProTimeline component into App.tsx.

### Verify

- [x] Split, trim, delete, drag work correctly.
- [x] Snapping accurate within ±1 frame.
- [x] Zoom adjusts layout.
- [x] Drag-and-drop from Media Library to timeline tracks.
- [x] Project state persists correctly.

---

## PR 15 — Undo / Redo + Auto-Save ✅

**Branch:** `feature/recording-suite` (integrated)  
**Goal:** Add action history stack with undo/redo and reliable auto-save.  
**Status:** COMPLETED

### Tasks

- [x] Add `historyService.ts` for timeline actions.
- [x] Keyboard shortcuts: ⌘Z / ⌘⇧Z.
- [x] Debounced auto-save (3s).
- [x] Restore last save on reopen.
- [x] Integrate into TimelineContext.
- [x] Save status indicator in TopBar.

### Verify

- [x] Undo/redo 10+ edits accurately.
- [x] Auto-save triggers correctly.
- [x] State restored after restart.

---

## PR 16 — Text Overlays (Manual) ✅

**Branch:** `feature/text-overlays` (integrated into `feature/recording-suite`)  
**Goal:** Allow adding custom text overlays with fonts, color, and animation.  
**Status:** COMPLETED

### Tasks

- [x] Add overlay track (`overlayTrackId = 1`).
- [x] "Add Text" button → Overlay Inspector.
- [x] Properties: Font, Size, Color
- [x] Preview overlay in timeline.
- [x] Export via FFmpeg `drawtext`.

### Verify

- [x] Overlay displays correctly.
- [x] Export includes overlay text.
- [x] Font and styles aligned

---

## PR 17 — AI Caption Generation (Whisper + GPT)

**Branch:** `feature/ai-captioning`  
**Goal:** Use OpenAI Whisper + GPT-4o to generate timed captions as overlays.

### Tasks

- [ ] Extract audio → Whisper (`model=whisper-1`).
- [ ] Whisper → transcript JSON → GPT-4o caption chunking.
- [ ] Convert to `Overlay[]`; add to overlay track.
- [ ] Add “Send audio to OpenAI” toggle.
- [ ] Save `.srt` to project folder.

### Verify

- Captions align within ±3 frames.
- Toggle disables network use.
- Captions export correctly.
- Logs added to memory bank.

---

## PR 18 — Packaging + GitHub Release

**Branch:** `feature/github-release`  
**Goal:** Package macOS `.dmg` with FFmpeg and publish via GitHub Release.

### Tasks

- [ ] Update `electron-builder.yml` with FFmpeg under `extraResources`.
- [ ] Add build scripts (`npm run build`, `npm run package:mac`).
- [ ] Upload `.dmg` to GitHub Release.
- [ ] Verify install/run outside dev.

### Verify

- `.dmg` builds and runs cleanly.
- README includes valid link + checksum.

---

## PR 19 — Final QA & Performance Pass

**Branch:** `qa/final-verification`  
**Goal:** Validate full recording/editing performance.

### Tasks

- [ ] Record 15-sec screen + mic + webcam.
- [ ] Edit timeline, trim, delete, add overlays.
- [ ] Run AI captioning.
- [ ] Export and test playback.
- [ ] Write `Testing_Document.md` summary.

### Verify

- Performance meets targets.
- No crashes or dropped frames.

---

## Notes for Cursor

- Update `memory-bank.json` each PR.
- Log AI usage (model, tokens).
- Document results in `/docs/PR_Summaries.md`.
- Push branch → open PR → merge after manual verification.
