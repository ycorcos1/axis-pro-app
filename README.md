# Axis Pro

**Professional-grade, minimalist desktop video editor built with Electron + React + TypeScript**

Walkthrough Video: https://www.youtube.com/watch?v=HkHcY1KhOhc&t=7s

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/ycorcos1/axis-pro-app/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)]()

> **Precision Without Noise**

**Axis Pro** delivers a refined, high-performance editing environment that looks and feels like a native macOS / Windows studio tool. Its design balances **precision, silence, and intent** — a workspace that helps creators stay on their axis.

## 🎬 Features at a Glance

- 🎥 **Native Recording** - Screen, webcam, audio, and PiP capture
- 🎬 **Multi-Track Timeline** - Professional video, audio, and text overlay tracks
- 📝 **Text Overlays** - Custom fonts, animations, and positioning
- ⚡ **Real-time Preview** - Instant playback with frame-accurate scrubbing
- 🚀 **Fast Export** - Hardware-accelerated MP4 export
- 🤖 **AI Shorts (Beta)** - Auto-generate viral clips with AI captions
- ⌨️ **Keyboard Shortcuts** - Pro-level workflow efficiency
- 💾 **Project Management** - Auto-save and project history

## Architecture

```
┌─────────────────┐     ┌──────────┐     ┌──────────────────┐
│   React UI      │────▶│  Preload │────▶│  Main Process    │
│  (Renderer)     │◀────│ (Bridge) │◀────│  (Electron)      │
└─────────────────┘     └──────────┘     └────────┬─────────┘
                                                   │
                                                   ▼
                                           ┌─────────────┐
                                           │   FFmpeg    │
                                           │  (External) │
                                           └─────────────┘
```

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
- ✅ PR #13: Recording Suite (Screen, Webcam, Mic, PiP)
- ✅ PR #14: Pro Timeline (Multi-Track Editing)
- ✅ PR #15: Undo/Redo + Auto-Save
- ✅ PR #16: Text Overlays (Manual)
- ✅ PR #17: AI Shorts (One-Click Generator with Whisper + GPT)

### Current Features

- Electron + React + TypeScript foundation
- Pro-Studio Minimalist UI with 5-panel layout
- Secure IPC communication via contextBridge
- Type-safe API contracts for file selection, media probing, and export
- FFmpeg service for video processing (probe & trim/export)
- **Dashboard with project management (create, open, rename, duplicate, delete)**
- **Media import via drag-and-drop or file picker**
- **Media Library displays imported clips with metadata (duration, resolution)**
- **Multi-track timeline with drag-and-drop, split, trim, delete, zoom, and snapping**
- **Preview player with playback controls and scrubber**
- **Export videos to MP4 with hardware acceleration**
- **Screen, webcam, and mic recording with PiP support**
- **Undo/Redo with ⌘Z / ⌘⇧Z shortcuts**
- **Auto-save with 2-second debounce**
- **Text overlays with custom fonts, colors, positioning, and animations**
- **AI Shorts: Automatically generate 3-5 short vertical videos (1080×1920) with AI-generated captions from long-form content**
- **Keyboard shortcuts (⌘/Ctrl+I for Import, ⌘/Ctrl+E for Export, Space for play/pause)**

See [docs/PR_Summaries.md](docs/PR_Summaries.md) for complete implementation details.

## 📥 Installation

### Option 1: Download Pre-Built App (Recommended)

Download the latest release from [GitHub Releases](https://github.com/ycorcos1/axis-pro-app/releases).

#### macOS Installation

1. Download `Axis-Pro-1.0.0-mac-arm64.zip` from releases
2. Extract the ZIP file (double-click)
3. Drag "Axis Pro.app" to Applications folder
4. **Important:** Right-click the app → "Open" → Click "Open" again
   - This bypasses macOS Gatekeeper for unsigned apps
   - Only needed on first launch

**If you see "damaged" error:**

```bash
xattr -cr "/Applications/Axis Pro.app"
```

**Requirements:** macOS 10.14+ (Mojave or later), Apple Silicon (M1/M2/M3) or Intel

#### Windows Installation

1. Download `Axis-Pro-Setup-1.0.0.exe` from releases
2. Run the installer
3. Follow installation prompts
4. Launch from Start Menu

**Requirements:** Windows 10 or later (64-bit)

---

### Option 2: Build from Source

Perfect for developers or testers who want the latest features.

#### Quick Start (5 minutes)

1. **Install Node.js 20+**

   ```bash
   # macOS
   brew install node

   # Windows
   # Download from nodejs.org
   ```

2. **Clone and Install**

   ```bash
   git clone https://github.com/ycorcos1/axis-pro-app.git
   cd axis-pro-app
   npm install
   ```

3. **Setup FFmpeg** (Required for video processing)

   **macOS (Automated):**

   ```bash
   ./setup-ffmpeg.sh
   ```

   **Windows/Manual Setup:** See [FFmpeg Setup Guide](#ffmpeg-setup) below

4. **Run the App**

   ```bash
   npm run dev
   ```

5. **Start Creating!**
   - Import videos (drag & drop or Cmd/Ctrl+I)
   - Edit on multi-track timeline
   - Add text overlays
   - Export to MP4 (Cmd/Ctrl+E)

#### Optional: AI Shorts Setup

To enable AI-powered short video generation:

1. Get an OpenAI API key from [platform.openai.com](https://platform.openai.com)
2. Create `.env` file in project root:
   ```bash
   OPENAI_API_KEY=sk-your-api-key-here
   ```
3. Restart app and access "✨ AI Shorts" from Dashboard

**Note:** AI Shorts is optional and not required for core functionality.

---

### 📝 For Graders/Reviewers

**Testing AI Shorts Feature:**

⚠️ **Important:** AI Shorts only works when running from source code (not in the packaged app).

To test the AI Shorts feature:

```bash
# 1. Clone and install
git clone https://github.com/ycorcos1/axis-pro-app.git
cd axis-pro-app
npm install

# 2. Setup FFmpeg
./setup-ffmpeg.sh

# 3. Add your OpenAI API key
echo "OPENAI_API_KEY=sk-your-key-here" > .env

# 4. Run in development mode
npm run dev

# 5. Click "✨ AI Shorts (Beta)" on the Dashboard
```

**Why?** The `.env` file is excluded from packaged builds for security. When running from source with `npm run dev`, the environment variables load correctly.

**All other features** (recording, timeline editing, text overlays, export, etc.) work in both development and packaged versions without any API key.

## Development

### Prerequisites

- **Node.js**: v20.x or later (tested with v20.10.0)
- **npm**: v9.x or later (bundled with Node.js)
- **FFmpeg binaries** (required for video processing)
- **macOS**: 10.14 (Mojave) or later (for macOS builds)
- **Windows**: 10 or later (for Windows builds)

## 🔧 FFmpeg Setup

Axis Pro requires FFmpeg for video processing. Choose your setup method:

### macOS Setup

#### Option A: Automated Setup (Recommended) ⚡

```bash
./setup-ffmpeg.sh
```

This script automatically downloads and configures FFmpeg binaries for you.

#### Option B: Manual Setup

1. **Download FFmpeg for macOS:**

   - Visit [evermeet.cx/ffmpeg](https://evermeet.cx/ffmpeg/)
   - Download both `ffmpeg` and `ffprobe` static binaries

2. **Install binaries:**

   ```bash
   # Create directory
   mkdir -p resources/ffmpeg/mac

   # Copy downloaded binaries (adjust paths as needed)
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

4. **Verify installation:**
   ```bash
   ./resources/ffmpeg/mac/ffmpeg -version
   ./resources/ffmpeg/mac/ffprobe -version
   ```
   You should see version information if installed correctly.

### Windows Setup

1. **Download FFmpeg for Windows:**

   - Visit [www.gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/)
   - Download `ffmpeg-release-essentials.zip`
   - Extract the ZIP file

2. **Install binaries:**

   ```bash
   # Create directory
   mkdir -p resources/ffmpeg/windows

   # Copy these files from extracted folder to resources/ffmpeg/windows/:
   # - bin/ffmpeg.exe
   # - bin/ffprobe.exe
   ```

3. **Verify installation:**
   ```cmd
   resources\ffmpeg\windows\ffmpeg.exe -version
   resources\ffmpeg\windows\ffprobe.exe -version
   ```

### Troubleshooting FFmpeg

**FFmpeg not found errors:**

- Ensure binaries are in correct directory (`resources/ffmpeg/mac/` or `resources/ffmpeg/windows/`)
- Check that binaries are executable: `ls -l resources/ffmpeg/mac/`
- On macOS, remove quarantine attributes if needed
- Run in DevTools console to diagnose: `window.electronAPI.checkFFmpeg()`

**The app will display helpful error messages if FFmpeg is not installed.**

### AI Shorts Setup (Optional)

**AI Shorts** is an optional feature that uses OpenAI's Whisper and GPT models to automatically generate short-form vertical videos from long-form content.

**Requirements:**

- OpenAI API key (get one at [platform.openai.com](https://platform.openai.com))

**Setup:**

1. **Create a `.env` file** in the project root:

   ```bash
   # Navigate to project root
   cd axis-pro-app

   # Create .env file
   touch .env
   ```

2. **Add your OpenAI API key** to the `.env` file:

   ```
   OPENAI_API_KEY=sk-your-api-key-here
   ```

   Replace `sk-your-api-key-here` with your actual OpenAI API key.

3. **Restart the app** if it's already running:

   ```bash
   npm run dev
   ```

4. **Access AI Shorts** from the Dashboard:
   - Click the "✨ AI Shorts (Beta)" button
   - Upload a long video
   - Click "Generate Shorts"
   - Wait for AI to transcribe, analyze, and render 3-5 short clips
   - Export individual shorts or all at once

**Features:**

- ✨ Auto-transcription with Whisper AI
- 🤖 Intelligent highlight detection with GPT-4
- 🎬 Portrait video output (1080×1920, 9:16)
- 📝 AI-generated captions burned into video
- 💾 Exports include `.mp4`, `.srt`, and metadata `.json`

**Note:** The `.env` file is already in `.gitignore` and will not be committed to your repository.

### Quick Start

1. **Clone and install**:

   ```bash
   git clone https://github.com/ycorcos1/axis-pro-app.git
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

### Build from Source

To build a distributable version of the app from source:

1. **Clone and install dependencies** (if you haven't already):

   ```bash
   git clone https://github.com/ycorcos1/axis-pro-app.git
   cd axis-pro-app
   npm install
   ```

2. **Setup FFmpeg binaries** (see FFmpeg Setup section above)

3. **Build for your platform**:

   **macOS:**

   ```bash
   npm run build:mac
   ```

   Creates: `dist/Axis-Pro-1.0.0-mac-arm64.zip`

   **Windows:**

   ```bash
   npm run build:win
   ```

   Creates: `dist/Axis Pro Setup 1.0.0.exe`

4. **Install the app**:
   - **macOS**: Extract the ZIP and drag "Axis Pro.app" to Applications
   - **Windows**: Run the `.exe` installer

**Note**: You need FFmpeg binaries for your platform in the `resources/ffmpeg/[platform]/` directory before building.

### Troubleshooting

**First Launch Security Warning (macOS)**:

If you see "App is damaged" or "unidentified developer":

```bash
# Remove quarantine attribute
xattr -cr "/Applications/Axis Pro.app"
```

Or right-click the app → "Open" → Click "Open" in the dialog

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

### Verify Installation

After running `npm run dev`, you should see:

- ✅ Electron window opens with Axis Pro interface
- ✅ 5-panel layout visible (TopBar, MediaLibrary, Preview, Timeline, Properties)
- ✅ No errors in console
- ✅ FFmpeg working (check DevTools console: `window.electronAPI.checkFFmpeg()`)

If you see any errors, check [Troubleshooting](#troubleshooting) section.

### Testing the Application

#### Quick Test Workflow

1. **Start the app**:

   ```bash
   npm run dev
   ```

2. **Import a video**:

   - Click "Import" button or press ⌘/Ctrl+I
   - Select an MP4 or MOV file

3. **Trim the video**:

   - Select the clip in Media Library
   - Drag the trim handles on the Timeline
   - Adjust zoom for precision

4. **Preview the edit**:

   - Use playback controls in Preview Panel
   - Press Space to play/pause
   - Scrub through the timeline

5. **Export**:
   - Click "Export" button or press ⌘/Ctrl+E
   - Choose save location
   - Wait for export to complete

#### Detailed Testing Guide

For comprehensive testing procedures, see [docs/Testing_Document.md](docs/Testing_Document.md)

#### Known Issues

- See [INSTALLATION_TROUBLESHOOTING.md](INSTALLATION_TROUBLESHOOTING.md) for common issues and solutions
- First launch on macOS may show security warning (see Installation section)

### Build for Production

```bash
npm run build
```

### Package for Distribution

**macOS:**

```bash
npm run pack:mac
```

Creates: `dist/Axis Pro-0.1.0-arm64.dmg`

**Windows:**

```bash
npm run pack:win
```

Creates: `dist/Axis Pro Setup 0.1.0.exe`

**Note:** Distribution packages are created in the `dist/` directory

### Complete Build (Recommended)

**macOS:**

```bash
npm run build:mac
```

Builds the app and packages it into a `.dmg` in one command.

**Windows:**

```bash
npm run build:win
```

Builds the app and packages it into a `.exe` installer in one command.

## Distribution

### Download from GitHub Releases

Pre-built installers for macOS and Windows are available on [GitHub Releases](https://github.com/yourusername/axis-pro-app/releases).

**Latest Release**: Download your platform-specific installer and follow the installation instructions below.

### Installation

#### macOS

1. **Download** the `.dmg` file from GitHub Releases
2. **Mount** the DMG by double-clicking it
3. **Install** by dragging "Axis Pro" to your Applications folder
4. **Launch** from Applications or Spotlight search

**Note**: macOS may warn about an unsigned application. To run the app:

- Right-click the app → Open → Click "Open" in the dialog
- Or add an exception in System Preferences → Security & Privacy

#### Windows

1. **Download** the `.exe` installer from GitHub Releases
2. **Run** the installer (`Axis Pro Setup 0.1.0.exe`)
3. **Follow** the installation wizard
4. **Launch** from Start Menu or desktop shortcut

### System Requirements

**macOS:**

- **macOS**: 10.14 (Mojave) or later
- **RAM**: 4 GB minimum (8 GB recommended)
- **Storage**: 500 MB for the app + space for your projects

**Windows:**

- **Windows**: 10 or later
- **RAM**: 4 GB minimum (8 GB recommended)
- **Storage**: 500 MB for the app + space for your projects

### Creating a GitHub Release

To create a new release:

1. **Build the app**:

   ```bash
   # macOS
   npm run build:mac

   # Windows (run on Windows machine or CI/CD)
   npm run build:win
   ```

2. **Create a release on GitHub**:
   - Go to your repository on GitHub
   - Click "Releases" → "Create a new release"
   - Create a new tag (e.g., `v0.1.0`)
   - Upload the `.dmg` file (and `.exe` if built) from `dist/` directory
   - Add release notes highlighting MVP features
   - Publish the release

### Building from a Separate Clone

To create a standalone build in a separate directory (useful for testing or distribution while continuing development):

1. **Clone to a new directory**:

   ```bash
   # Navigate to your workspace parent directory
   cd ~/Desktop/gauntlet-workspace

   # Clone the repository to a new directory
   git clone https://github.com/ycorcos1/axis-pro-app.git axis-pro-build

   # Navigate into the new directory
   cd axis-pro-build
   ```

2. **Checkout your desired branch**:

   ```bash
   # Check available branches
   git branch -a

   # Checkout the branch you want to build
   git checkout <branch-name>
   ```

3. **Install dependencies**:

   ```bash
   npm install
   ```

4. **Setup FFmpeg** (if needed):

   ```bash
   ./setup-ffmpeg.sh  # macOS only
   ```

5. **Build and package the app**:

   ```bash
   # For macOS
   npm run build:mac

   # For Windows
   npm run build:win
   ```

6. **Find your packaged app**:
   - ZIP file: `dist/Axis-Pro-0.1.0-mac-arm64.zip` (or similar)
   - DMG: `dist/Axis Pro-0.1.0-arm64.dmg` (if DMG creation succeeded)
   - Windows installer: `dist/Axis Pro Setup 0.1.0.exe`

**Benefits of this approach**:

- ✅ Separate directory from your main development repository
- ✅ Can continue working on other branches without affecting the build
- ✅ Clean, isolated build environment
- ✅ Easy to rebuild when needed

**To update the build later**:

```bash
cd ~/Desktop/gauntlet-workspace/axis-pro-build
git fetch origin
git pull origin <branch-name>
npm install
npm run build:mac  # or build:win
```

## Project Structure

```
axis-pro-app/
├── app/
│   ├── main/          # Electron main process (Node.js)
│   │   ├── main.ts    # Window management, IPC handlers
│   │   ├── ffmpegService.ts  # FFmpeg wrapper
│   │   └── ...
│   ├── preload/       # Preload scripts (IPC bridge)
│   │   └── preload.ts # contextBridge API
│   ├── renderer/      # React UI application
│   │   └── src/
│   │       ├── App.tsx          # Main app component
│   │       ├── components/      # UI components
│   │       └── styles/          # CSS files
│   └── shared/        # Shared types between main/renderer
│       ├── types.ts   # Common TypeScript interfaces
│       └── ...
├── build/             # Build resources (icons)
├── dist/              # Build output (compiled files, packages)
├── docs/              # Documentation
│   ├── Axis_Pro_Design_Specification_Sheet_v2.md
│   ├── Axis_Pro_MVP_PRD_v2.md
│   ├── Axis_Pro_MVP_Task_List_v2.md
│   ├── Testing_Document.md
│   ├── PR_Summaries.md
│   ├── memory-bank.json
│   └── ...
├── resources/         # FFmpeg binaries
│   └── ffmpeg/
│       ├── mac/       # macOS binaries
│       └── windows/   # Windows binaries
├── package.json       # Dependencies and scripts
├── tsconfig.json      # TypeScript configuration
├── vite.config.ts     # Vite bundler configuration
├── electron-builder.yml  # Electron packaging config
├── setup-ffmpeg.sh    # Automated FFmpeg setup script
└── README.md          # This file
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
