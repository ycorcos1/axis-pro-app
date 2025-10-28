# Axis Pro

Professional-grade, minimalist desktop video editor built with Electron + React + TypeScript.

## Vision

**Axis Pro** delivers a refined, high-performance editing environment that looks and feels like a native macOS / Windows studio tool. Its design balances **precision, silence, and intent** — a workspace that helps creators stay on their axis.

Tagline: _Precision Without Noise_

## Architecture

- **Framework**: Electron + React + TypeScript
- **Main Process**: App lifecycle, window management, media processing
- **Preload**: Secure IPC bridge via contextBridge
- **Renderer**: React UI with Vite for fast HMR
- **Media Engine**: FFmpeg for video processing

## Project Status

✅ **MVP Complete** - Ready for Distribution

### Completed PRs

- ✅ PR #1: Initialize Electron + React app skeleton
- ✅ PR #2: Design tokens, base theme, and layout frame
- ✅ PR #3: IPC Surface (secure)
- ✅ PR #4: FFmpeg Service (probe + trim/export)
- ✅ PR #5: Media Import + Library View
- ✅ PR #6: Timeline Track + Trim Handles
- ✅ PR #7: Preview Player
- ✅ PR #8: Export MP4
- ✅ PR #9: Dashboard (Projects Grid)
- ✅ PR #10: UX Polish (Toast Notifications)
- ✅ PR #11: Project Persistence (Save/Load)
- ✅ PR #12: Packaging and Distribution

### Current Features

- Electron + React + TypeScript foundation
- Pro-Studio Minimalist UI with 5-panel layout
- Secure IPC communication via contextBridge
- Type-safe API contracts for file selection, media probing, and export
- FFmpeg service for video processing (probe & trim/export)
- **Dashboard with project management (create, open, rename, duplicate, delete)**
- **Media import via drag-and-drop or file picker**
- **Media Library displays imported clips with metadata (duration, resolution)**
- **Timeline with draggable trim handles and zoom controls**
- **Preview player with playback controls and scrubber**
- **Export trimmed videos to MP4**
- **Keyboard shortcuts (⌘/Ctrl+I for Import, ⌘/Ctrl+E for Export, Space for play/pause)**

See [docs/PR_Summaries.md](docs/PR_Summaries.md) for complete implementation details.

## Development

### Prerequisites

- Node.js (LTS recommended)
- npm or pnpm
- **FFmpeg binaries** (required for video processing)

### FFmpeg Setup

Axis Pro requires FFmpeg for video processing. Download and install the binaries:

1. **Download FFmpeg for macOS**:

   - Visit [evermeet.cx/ffmpeg](https://evermeet.cx/ffmpeg/) or [ffmpeg.org](https://ffmpeg.org/download.html)
   - Download both `ffmpeg` and `ffprobe` static binaries

2. **Install binaries**:

   ```bash
   # Create directory if it doesn't exist
   mkdir -p resources/ffmpeg/mac

   # Copy downloaded binaries
   cp ~/Downloads/ffmpeg resources/ffmpeg/mac/ffmpeg
   cp ~/Downloads/ffprobe resources/ffmpeg/mac/ffprobe

   # Make executable
   chmod +x resources/ffmpeg/mac/ffmpeg
   chmod +x resources/ffmpeg/mac/ffprobe
   ```

3. **Remove macOS quarantine** (required for unsigned binaries):

   ```bash
   xattr -d com.apple.quarantine resources/ffmpeg/mac/ffmpeg
   xattr -d com.apple.quarantine resources/ffmpeg/mac/ffprobe
   ```

4. **Verify installation**:
   ```bash
   ./resources/ffmpeg/mac/ffmpeg -version
   ./resources/ffmpeg/mac/ffprobe -version
   ```

**Note**: The app will display a helpful error message if FFmpeg is not installed.

### Quick Start

1. **Clone and install**:

   ```bash
   git clone <repository-url>
   cd axis-pro-app
   npm install
   ```

2. **Setup FFmpeg** (required for video processing):

   - Download `ffmpeg` and `ffprobe` from [evermeet.cx/ffmpeg](https://evermeet.cx/ffmpeg/)
   - Copy to `resources/ffmpeg/mac/`
   - Run: `chmod +x resources/ffmpeg/mac/*`
   - Remove quarantine: `xattr -d com.apple.quarantine resources/ffmpeg/mac/*`

3. **Run the app**:
   ```bash
   npm run dev
   ```

### Troubleshooting

**FFmpeg not found errors**:

- Ensure binaries are in `resources/ffmpeg/mac/` directory
- Check that binaries are executable: `ls -l resources/ffmpeg/mac/`
- Remove quarantine attributes if on macOS
- Run `window.electronAPI.checkFFmpeg()` in DevTools console to diagnose

**Project not saving**:

- Check that `~/AxisPro/projects/` directory exists
- Verify write permissions on home directory
- Check console for error messages

**Import not working**:

- Ensure video files are MP4 or MOV format
- Check file permissions are readable
- Try small test files first (< 100MB)

### Run Development

```bash
npm run dev
```

This will:

1. Build the main process TypeScript files
2. Start Vite dev server on port 5173
3. Launch Electron window
4. Enable hot module reloading

### Build for Production

```bash
npm run build
```

### Package for macOS

```bash
npm run pack:mac
```

Creates a distributable `.dmg` file in the `dist` directory.

### Complete Build (Recommended)

```bash
npm run build:mac
```

Builds the app and packages it into a `.dmg` in one command.

## Distribution

### Download from GitHub Releases

Pre-built macOS installers are available on [GitHub Releases](https://github.com/yourusername/axis-pro-app/releases).

**Latest Release**: Download `Axis Pro-0.1.0.dmg` and follow the installation instructions below.

### Installation

1. **Download** the `.dmg` file from GitHub Releases
2. **Mount** the DMG by double-clicking it
3. **Install** by dragging "Axis Pro" to your Applications folder
4. **Launch** from Applications or Spotlight search

**Note**: macOS may warn about an unsigned application. To run the app:

- Right-click the app → Open → Click "Open" in the dialog
- Or add an exception in System Preferences → Security & Privacy

### System Requirements

- **macOS**: 10.14 (Mojave) or later
- **RAM**: 4 GB minimum (8 GB recommended)
- **Storage**: 500 MB for the app + space for your projects

### Creating a GitHub Release

To create a new release:

1. **Build the app**:

   ```bash
   npm run build:mac
   ```

2. **Create a release on GitHub**:
   - Go to your repository on GitHub
   - Click "Releases" → "Create a new release"
   - Create a new tag (e.g., `v0.1.0`)
   - Upload the `.dmg` file from `dist/` directory
   - Add release notes highlighting MVP features
   - Publish the release

## Project Structure

```
axis-pro/
├── app/
│   ├── main/          # Electron main process
│   ├── preload/       # Preload scripts (IPC bridge)
│   └── renderer/      # React UI application
├── docs/              # Documentation
│   ├── Axis_Pro_Design_Specification_Sheet.md
│   ├── Axis_Pro_MVP_PRD.md
│   ├── Axis_Pro_MVP_Task_List.md
│   ├── Implementation_Summary.md
│   ├── Testing_Document.md
│   └── memory-bank.json
├── dist/              # Build output
├── resources/         # FFmpeg binaries
└── package.json
```

## Design Philosophy

**Pro-Studio Minimalist**: Quiet power, clear focus, zero clutter.

### Core Principles

1. **Clarity Over Decoration** — every visual element serves a purpose
2. **Depth Through Light, Not Color** — subtle gradients replace heavy contrast
3. **Responsive Weight** — minimal, tactile interactions
4. **Native Feel** — desktop-native behaviors, fluid scrolling
5. **Speed Is Luxury** — transitions under 200 ms

## MVP Scope (Current)

Focus on the fundamentals: **import, preview, trim, export** + **project management**

- ✅ Electron + React app skeleton
- ✅ Design tokens and layout
- ✅ IPC surface setup
- ✅ FFmpeg service
- ✅ Media import
- ✅ Timeline with trim
- ✅ Preview player
- ✅ Export to MP4
- ✅ Dashboard (project management)
- ✅ Toast notifications (UX polish)
- ✅ Project persistence (save/load)
- ✅ Packaging for macOS (.dmg distribution)

## Usage

### Basic Workflow

1. **Create a project**: Click "New Project" on the Dashboard
2. **Import media**: Drag video files into the Media Library or click Import button
3. **Select clip**: Click on a clip in the Media Library
4. **Trim**: Adjust in/out handles on the Timeline
5. **Preview**: Use playback controls in the Preview Panel
6. **Export**: Click Export button to save trimmed video
7. **Save**: Project auto-saves or click Save button manually

### Keyboard Shortcuts

- **⌘/Ctrl + I**: Import media files
- **⌘/Ctrl + E**: Export trimmed video
- **Space**: Play/pause preview

## Documentation

- [MVP PRD v2](docs/Axis_Pro_MVP_PRD_v2.md) - Product requirements (updated)
- [Design Spec v2](docs/Axis_Pro_Design_Specification_Sheet_v2.md) - Visual & UX guidelines (updated)
- [Task List v2](docs/Axis_Pro_MVP_Task_List_v2.md) - Implementation roadmap (updated)
- [PR Summaries](docs/PR_Summaries.md) - Detailed PR implementation summaries
- [Testing Log](docs/Testing_Document.md) - Test execution records
- [Memory Bank](docs/memory-bank.json) - Architectural decisions and module documentation

## License

MIT
