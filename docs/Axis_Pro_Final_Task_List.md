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

## PR 14 — Advanced Timeline (Multi-Track, Snapping, Zoom)
**Branch:** `feature/advanced-timeline`  
**Goal:** Implement full multi-track editor, snapping, split, delete, and zoom.  

### Tasks
- [ ] Extend timeline for multiple tracks (main + overlay).
- [ ] Implement split at playhead, trim handles, and delete.
- [ ] Add zoom slider (25–400%).
- [ ] Add snap-to-grid and snap-to-clip edges toggle.
- [ ] Render stacked tracks; overlay above main.  

### Verify
- Split, trim, delete, drag work correctly.
- Snapping accurate within ±1 frame.
- Zoom adjusts layout.

---

## PR 15 — Undo / Redo + Auto-Save
**Branch:** `feature/undo-redo`  
**Goal:** Add action history stack with undo/redo and reliable auto-save.  

### Tasks
- [ ] Add `historyService.ts` for timeline actions.
- [ ] Keyboard shortcuts: ⌘Z / ⌘⇧Z.
- [ ] Debounced auto-save (3s).
- [ ] Restore last save on reopen.  

### Verify
- Undo/redo 10+ edits accurately.
- Auto-save triggers correctly.
- State restored after restart.

---

## PR 16 — Text Overlays (Manual)
**Branch:** `feature/text-overlays`  
**Goal:** Allow adding custom text overlays with fonts, color, and animation.  

### Tasks
- [ ] Add overlay track (`overlayTrackId = 1`).
- [ ] “Add Text” button → Overlay Inspector.
- [ ] Properties: Font, Size, Color, Animation, Timing.
- [ ] Preview overlay in timeline.
- [ ] Export via FFmpeg `drawtext`.  

### Verify
- Overlay displays correctly.
- Export includes overlay text.
- Animation and font applied.

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
