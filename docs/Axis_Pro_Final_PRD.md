# Axis Pro — Final Product Requirement Document (PRD)
**Version:** 1.0  
**App:** Axis Pro (Electron + React)  
**Theme:** Pro‑Studio Minimalist  
**Authoring Intent:** This PRD is optimized for Cursor. It is the single source of truth for the Final Phase beyond MVP.

---

## 0. Summary
Axis Pro is a desktop video editor. MVP is complete (import, preview, timeline trim, export, packaging, dashboard).  
The Final Phase expands capabilities to include a **Recording Suite**, an **advanced multi‑track timeline**, and **AI‑assisted text overlays** (Whisper transcription + GPT caption suggestions). Distribution uses **GitHub Releases**.

---

## 1. Goals & Non‑Goals
### 1.1 Goals
- Screen + webcam + mic recording, including **simultaneous PiP** capture.
- Direct‑to‑timeline ingest of recordings.
- Multi‑track timeline with split/delete, snapping, and zoom for precision.
- Text overlay track with **custom fonts & basic animations**, plus **AI caption suggestions**.
- Stable performance & packaging suitable for grading/submission via GitHub Releases.

### 1.2 Non‑Goals (Final Phase)
- Cloud projects/sync, multi‑user collaboration.
- Advanced color grading, transitions library, effects stack.
- Server‑side rendering or cloud compute.

---

## 2. Users & Scenarios
- Creators recording tutorials, app demos, or commentary.
- Quick edit flow: *record → trims & overlays → export → share*.
- Batch sessions where multiple clips and takes are organized per project.

---

## 3. Architecture Overview
- **Desktop stack:** Electron (main + preload), React (renderer), TypeScript.
- **Media engine:** FFmpeg/FFprobe invoked from main process (`child_process.spawn`).  
- **Recording:** Electron `desktopCapturer` + `navigator.mediaDevices.getUserMedia()`; `MediaRecorder` for capture; mux/fix via FFmpeg as needed.
- **AI:** OpenAI API
  - **Whisper (transcriptions):** `/v1/audio/transcriptions` for ASR.
  - **GPT‑4o/mini (caption‑line suggestions & style tightening).`
- **State:** JSON project model on disk; thumbnails & cache stored per project folder.
- **Security:** IPC via `contextBridge`—whitelisted methods; no `nodeIntegration` in renderer.

---

## 4. Data & File Layout
Projects live under the user folder:

```
~/AxisPro/projects/<projectId>/
  project.json
  media/                # user-imported files (optional copies or references)
  recordings/           # screen/webcam/mic captures
  thumbs/               # thumbnails (jpg) for dashboard & timeline
  overlays/             # optional assets (ass/webm-alpha/ttf)
```

### 4.1 Project Model (extended)
```ts
type Project = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  fps: number;
  baseResolution: { w: number; h: number }; // default from first clip or 1920x1080
  clips: Record<string, Clip>;
  segments: Segment[];             // V1: arranged on timeline (track = 0 for main, 1 for overlay)
  overlays?: Overlay[];            // text overlays (stretch goal)
  tracks: Track[];                 // at least 2: main video (0), overlay/PiP (1)
  ai?: {
    transcriptPath?: string;       // .srt/.vtt from Whisper
    captionOverlaysGenerated?: boolean;
    modelNotes?: string;
  };
  stats?: { durationMs?: number; resolution?: string };
};

type Track = { id: number; kind: "video" | "overlay"; name: string; muted?: boolean; locked?: boolean };

type Clip = {
  id: string;
  path: string;
  durationMs: number;
  width: number;
  height: number;
  fps?: number;
  audioChannels?: number;
  thumb?: string; // thumbs/<id>.jpg
};

type Segment = {
  id: string;
  trackId: number;     // 0 main, 1 overlay (PiP/video overlay)
  clipId: string;
  inMs: number;
  outMs: number;
  startMs: number;     // timeline position
  transform?: { x?: number; y?: number; scale?: number }; // for PiP positioning
};

type Overlay = {
  id: string;
  kind: "text";
  content: string;
  font: { family: string; size: number; weight?: number; lineHeight?: number; letterSpacing?: number };
  fill: string; // hex
  stroke?: { color: string; width: number; opacity?: number };
  bounds: { x: number; y: number; anchor: "center" | "tl" | "tr" | "bl" | "br" }; // normalized 0..1
  appear: number;      // seconds
  disappear: number;   // seconds
  animation?: { in?: Anim; out?: Anim };
};
type Anim = { name: "fade" | "fadeUp"; duration: number; easing?: string };
```

---

## 5. Features & Acceptance Criteria

### 5.1 Recording Suite
**User Stories**
- As a user, I can **record the screen** (full monitor or window) and **microphone**.
- I can **toggle webcam** as PiP, reposition/resize the webcam feed.
- When I stop recording, the capture **appears on the timeline** and in the media library.

**Implementation Notes**
- Use `desktopCapturer.getSources` to list screens & windows.
- Combine streams:
  - Screen: `getDisplayMedia` or `desktopCapturer` stream.
  - Webcam: `getUserMedia({ video: true })`.
  - Mic: `getUserMedia({ audio: true })`.
- Compose PiP during export via FFmpeg overlay filter **or** store tracks separately and preview composition in React canvas.
- Use `MediaRecorder` (webm) → remux to mp4 via FFmpeg if needed (`-c copy` when possible).

**Acceptance**
- User can pick **Screen** or **Window**; optionally enable **Webcam** and **Mic**.
- Start/Stop recording works; files saved to `recordings/`.
- On stop, a new **Clip** + **Segment** is created at playhead; preview playable; export succeeds.

---

### 5.2 Advanced Timeline
**Scope**
- Playhead with timecode; drag/drop; sequence re‑ordering.
- Trim in/out via handles; **Split at playhead**; **Delete** segments.
- **Two tracks minimum**: 0 main video; 1 overlay/PiP (video overlay segments allowed).
- **Zoom** slider 25%–400%.
- **Snapping**: to clip edges & playhead; toggleable.

**Acceptance**
- All operations are interactive and reflected in preview.
- Snapping accuracy within ±1 frame at base fps.
- Multiple tracks render in correct z‑order (overlay above main).

---

### 5.3 Text Overlays with AI Suggestions (Stretch)
**Scope**
- Manual **Text Overlay** creation with custom fonts (bundled TTF in `overlays/` or `resources/fonts/`).  
- Basic animations: `fade`, `fadeUp`.  
- **AI Generate Captions** button:
  1) Extract audio track → call **OpenAI Whisper** for transcription (JSON/SRT).  
  2) Feed transcript to **GPT‑4o / mini** to chunk lines to 1–2 lines, 28–32 chars/line, add timing windows.  
  3) Convert to `Overlay[]`; place on overlay track.

**Export Options**
- **Path A (fast):** FFmpeg `drawtext` filter with `enable=between(t,a,b)` and position/alpha expressions.  
- **Path B (rich):** Render HTML/WebM‑alpha overlays via headless Chromium and composite in FFmpeg.

**Acceptance**
- Manual overlays render in preview and export.  
- AI flow produces readable captions aligned within ±3 frames of speech.

---

### 5.4 Undo/Redo & Auto‑Save
- Command stack for timeline ops (add/move/split/trim/delete/overlay edits).
- Auto‑save debounce every 3s or on significant action; updates `updatedAt`.
- Project open restores exact state.

**Acceptance**
- Undo/redo works across timeline edits; no corrupted state.
- After crash/quit, reopen restores last save.

---

## 6. UI/UX
- **Dashboard:** grid of projects with thumb, title, last edited, duration, res.
- **Editor:** left library, center preview, right properties, bottom timeline.  
- **Recording HUD:** compact panel with Source (Screen/Window), Webcam toggle, Mic toggle, Start/Stop.  
- **Overlay Inspector:** font, size, color, animation dropdown; timing fields (appear/disappear).  
- **Toasts:** export complete path; recording started/stopped; AI generation finished.

---

## 7. Performance Targets
- Importing and scrubbing **10+ clips** remains responsive.  
- Recording 1080p + mic + webcam without dropped frames on typical Mac (M1/M2).  
- Export 1080p H.264 completes for a 60‑sec edit without errors.  
- Memory usage stable: no unbounded growth during long scrubs/edits.

---

## 8. Privacy & Permissions
- Mic/Camera permissions requested once; state persisted in app settings.  
- No media leaves the device **unless** user invokes OpenAI APIs; PRD requires a toggle: *“Send audio to OpenAI for transcription.”*  
- API key stored in OS keychain or `.env` (dev only).

---

## 9. Packaging & Distribution
- **Build:** `npm run build`
- **Package (macOS):** `npm run package:mac` (electron-builder)
  - Bundle FFmpeg binaries via `extraResources`.
  - Ensure sandbox‑safe paths for resources.
- **Release:** Create **GitHub Release** (draft → upload `.dmg`), update README with download link and checksums.

---

## 10. Telemetry & Logging (Local)
- Local debug logs (rotating); no PII.  
- Optional “Attach logs to bug report” zip for grading support.

---

## 11. Memory Bank Requirements
- Each module documents:
  - Purpose & contract
  - Key decisions & flags (e.g., FFmpeg overlay expressions)
  - Known limitations (e.g., drawtext kerning)
- AI actions append entries: model, prompts, token usage (rough), generated artifacts.

---

## 12. Risks & Mitigations
- **Recording mux issues:** use FFmpeg remux on stop; fallback re‑encode.  
- **Whisper latency:** limit to selected segments; show progress.  
- **Font licensing:** bundle only permissible fonts; document sources.  
- **Electron permission prompts:** test first‑run flows thoroughly.

---

## 13. Out of Scope
- Windows/Linux packaging, code‑signing/notarization, color management, effect pipeline, multi‑cam sync, collaboration.

---

## 14. Milestones (High Level)
1) Recording Suite (screen/webcam/mic + PiP ingest)  
2) Advanced Timeline (multi‑track, split/delete, zoom, snapping)  
3) Undo/Redo + Auto‑Save hardening  
4) Text Overlays (manual) → AI Caption Suggestions  
5) Packaging + GitHub Release

---

## 15. Acceptance Test Plan (Smoke)
- Record 15‑second screen+mic → auto‑ingests to timeline → export works.  
- Add webcam PiP and place on overlay track → export shows PiP top‑right.  
- Split clip at 10s, trim ends, delete middle → playthrough continuous.  
- Generate AI captions on a 30‑second segment → preview overlays OK → export renders text.  
- Undo/redo across 10 actions → state consistent.  
- Reopen project → all elements restored.

---

## 16. Appendix — API Notes
- **Recording**: `desktopCapturer.getSources`, `navigator.mediaDevices.getUserMedia`, `MediaRecorder`, `ondataavailable` chunks → file write.  
- **AI**:
  - Whisper: `POST /v1/audio/transcriptions` with `file`, `model=whisper-1`.  
  - GPT‑4o/mini: prompt with transcript to reflow into caption lines; return Overlay[].
- **FFmpeg**: overlay, drawtext, concat, re‑mux (`-c copy`), scale, fps filters.
