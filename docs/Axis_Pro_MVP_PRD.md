# Axis Pro — MVP Product Requirement Document (PRD)

## 1. Overview & Objective
Axis Pro is a professional-grade, minimalist desktop video editor focused on the essential editing loop: import, preview, timeline trim, and export. The MVP proves a robust media pipeline in a desktop context and must be built and packaged as a native desktop app by the MVP gate: Tuesday, Oct 28, 10:59 PM CT. The visual and interaction language is defined by the Axis Pro Design Spec (“Pro-Studio Minimalist”: clarity over decoration, native feel, speed).

## 2. MVP Scope & Acceptance Criteria
**Must haves (hard gate):**  
App launches; MP4/MOV import via drag-drop or picker; simple timeline showing imported clips; preview player plays imported clips; trim in/out on a single clip; export to MP4; packaged native app (not just dev mode).

**Out of scope for MVP:** screen/webcam recording, PiP overlay recording, transitions/effects, undo/redo, multi-OS parity (Windows optional), cloud upload.

**Definition of Done (DoD):**  
A signed-off build that demonstrates: 1) importing at least one MP4/MOV, 2) visible timeline item with draggable playhead, 3) trim in/out applied, 4) preview reflects trim, 5) export produces playable MP4, 6) packaged macOS app (.dmg) installable locally, 7) repo and README ready for reviewers per submission guidelines.

## 3. Architecture (MVP)
**Framework:** Electron + React.  
**Process model:** Electron main process manages filesystem and FFmpeg; renderer (React) manages UI (library, preview, timeline).  
**Media engine:** Local FFmpeg binary (bundled) invoked from the main process (`child_process.spawn`).  
**Timeline model:** Simple array of clip segments with in/out offsets; single track for MVP.  
**Preview:** HTML5 `<video>` for playback of source clips and trimmed preview.  
**Data:** Project state in JSON (in app data dir) with auto-save on change.  
**Styling:** Follows Axis Pro spec: dark matte palette, system fonts, 0.2s ease transitions, accent outline for selection.

## 4. Setup & Environment
From an empty folder on Desktop:

1. **Bootstrap**
   - `pnpm dlx create-electron-app axis-pro --template=webpack`
   - Add React + TypeScript (recommended) and Tailwind or CSS variables per spec.
2. **Dependencies**
   - Runtime: `electron`, `react`, `react-dom`.
   - Build: `electron-builder`.
   - Types/Dev: `typescript`, `vite` or `webpack`.
3. **FFmpeg**
   - Download static FFmpeg binary for macOS (store under `/resources/ffmpeg/mac/ffmpeg`), reference via `extraResources`.
4. **Security/IPC**
   - Use `preload.js` with `contextBridge` to expose API: `selectFiles()`, `importClips()`, `exportTimeline()`.
5. **Directory layout**
   ```
   /axis-pro
     /app
       /main
       /preload
       /renderer
     /resources/ffmpeg/mac/ffmpeg
     /docs
       PRD_MVP.md
       memory-bank.json
     electron-builder.yml
     package.json
   ```
6. **Build & Package**
   - Dev: `pnpm dev`
   - Package (macOS): `pnpm build && pnpm electron-builder --mac dmg`
7. **Submission prep**
   - Create GitHub repo, push code, tag MVP, draft Release with `.dmg` and README links.

## 5. Memory Bank
Stored in `/docs/memory-bank.json`. Cursor reads/writes this to align codegen.

**Schema (initial):**
```json
{
  "version": "0.1.0",
  "decisions": [
    {"id":"arch-fwk","when":"2025-10-27","what":"Electron+React","why":"Ship speed, ecosystem"},
    {"id":"media-ffmpeg","when":"2025-10-27","what":"Local ffmpeg via spawn","why":"Predictable performance"}
  ],
  "modules": {
    "ffmpegService": {
      "owner": "main",
      "api": ["probe(path)","trimExport(inputPath, inMs, outMs, outputPath)"],
      "notes": "Use -ss/-to and -c copy for fast cut when possible; fallback to re-encode."
    }
  },
  "todos": [
    "Add Windows build after MVP",
    "Introduce multi-track in Full Submission",
    "Add recording pipeline"
  ]
}
```

**In-code comment standard:**  
Every exported function begins with a docblock linked to memory-bank entries.

## 6. Feature Requirements (MVP)
**Import** — Drag/drop or picker for MP4/MOV, display duration and filename.  
**Timeline & Editing** — Single track, adjustable in/out handles.  
**Preview** — Plays selection; scrubbing updates frame.  
**Export** — Writes MP4; prefer `-c copy` else re-encode.  
**Packaging** — `.dmg` built with `electron-builder`.

## 7. UX/UI Mapping
Follow the Axis Pro spec: Top Bar (File/Import/Export), Left Media Library, Center Preview, Bottom Timeline, Right Properties. Transitions ≤200ms; keyboard shortcuts: Space (play/pause), ⌘/Ctrl+I (Import), ⌘/Ctrl+E (Export).

## 8. IPC & Module Contracts
**Preload API:**  
- `selectFiles(): Promise<string[]>`  
- `importClips(paths: string[]): Promise<Clip[]>`  
- `exportTimeline(segment, targetPath, options?): Promise<ExportResult>`  
- `probe(path: string): Promise<MediaInfo>`

**Main ffmpegService:**  
- `probe` → `ffprobe` for metadata.  
- `trimExport` → ffmpeg cut/export.

## 9. Build, Packaging, and Distribution
- Dev: `pnpm dev`  
- Build: `pnpm build`  
- Package: `pnpm electron-builder --mac dmg`  
- Release: Upload `.dmg` on GitHub Releases with README link.

## 10. Risks & Mitigations
- FFmpeg path after packaging → use `process.resourcesPath`.  
- Keyframe cuts may require re-encode fallback.  
- Large files → stream to ffmpeg.

## 11. Roadmap (Post-MVP)
Multi-track timeline, transitions, screen/webcam recording, PiP, autosave, undo/redo, export presets.
