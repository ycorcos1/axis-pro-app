# Axis Pro v0.1.0 - MVP Release

🎉 **First public release of Axis Pro MVP!**

Professional-grade, minimalist desktop video editor built with Electron + React + TypeScript.

## ✨ Features

- **Dashboard** - Project management with thumbnails and metadata
- **Media Import** - Drag-and-drop or file picker for MP4/MOV videos
- **Media Library** - Browse imported clips with metadata (duration, resolution)
- **Context Menu** - Right-click clips to relink or remove from project
- **Timeline Editing** - Draggable trim handles with zoom controls
- **Video Preview** - Playback with scrubber, play/pause controls
- **Export MP4** - Save trimmed videos to disk
- **Project Persistence** - Save and load your work
- **Keyboard Shortcuts** - ⌘/Ctrl+I (Import), ⌘/Ctrl+E (Export), Space (Play/Pause)
- **Cross-Platform** - Works on macOS and Windows

## 📦 Installation

### macOS

1. Download `Axis-Pro-0.1.0-mac-arm64.zip`
2. Extract the ZIP file (double-click)
3. Drag "Axis Pro.app" to your Applications folder
4. **IMPORTANT:** Right-click (or Control+click) the app → Choose "Open" → Click "Open" again in the dialog
   - You may see a warning that the app is "damaged" or "from an unidentified developer"
   - This is normal for unsigned apps - the right-click method bypasses Gatekeeper
   - You only need to do this once; subsequent launches work normally

**If you see "damaged" error:**

```bash
# Remove quarantine attribute from Terminal:
xattr -cr "/Applications/Axis Pro.app"
```

**System Requirements:** macOS 10.14 (Mojave) or later, Apple Silicon (M1/M2/M3)

### Windows

1. Download `Axis Pro Setup 0.1.0.exe`
2. Run the installer
3. Follow installation prompts
4. Launch from Start Menu or Desktop shortcut

**System Requirements:** Windows 10 or later (64-bit)

## 🚀 What's New

This MVP includes all 12 planned features:

- PR #1-3: Foundation (Electron + React + IPC)
- PR #4: FFmpeg integration
- PR #5-7: Import, Timeline, Preview
- PR #8: Export functionality
- PR #9: Dashboard
- PR #10: UX Polish (Toasts)
- PR #11: Project Save/Load
- PR #12: Packaging & Distribution

## 🐛 Bug Fixes (Post-MVP)

- Fixed FFmpeg packaging for production builds
- Resolved clip persistence issue (React state race condition)
- Implemented remove clip functionality
- Fixed FFmpeg path resolution for macOS

## 📝 Known Limitations

- App is unsigned (requires right-click → Open on first launch)
- Windows builds require Windows FFmpeg binaries (see README for setup)
- Linux builds not yet configured

## 🐛 Reporting Issues

Found a bug? Please open an issue on GitHub!

## 📚 Building from Source

See [README.md](README.md) for complete build instructions.

```bash
# Install dependencies
npm install

# Setup FFmpeg (see README)
mkdir -p resources/ffmpeg/mac

# Build for macOS
npm run build:mac

# Build for Windows
npm run build:win
```

## 🙏 Credits

Built with Electron, React, TypeScript, FFmpeg, and Vite.

---

**Full Changelog**: https://github.com/YOUR_USERNAME/axis-pro-app/commits/v0.1.0
