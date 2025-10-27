# Axis Pro

Professional-grade, minimalist desktop video editor built with Electron + React + TypeScript.

## Vision

**Axis Pro** delivers a refined, high-performance editing environment that looks and feels like a native macOS / Windows studio tool. Its design balances **precision, silence, and intent** — a workspace that helps creators stay on their axis.

Tagline: *Precision Without Noise*

## Architecture

- **Framework**: Electron + React + TypeScript
- **Main Process**: App lifecycle, window management, media processing
- **Preload**: Secure IPC bridge via contextBridge
- **Renderer**: React UI with Vite for fast HMR
- **Media Engine**: FFmpeg for video processing

## Project Status

🚧 **In Development** - PR #1 Complete

See [docs/Implementation_Summary.md](docs/Implementation_Summary.md) for progress details.

## Development

### Prerequisites
- Node.js (LTS recommended)
- npm or pnpm

### Setup
```bash
npm install
```

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

Focus on the fundamentals: **import, preview, trim, export**

- ✅ Electron + React app skeleton
- 🚧 Design tokens and layout
- 🚧 IPC surface setup
- 🚧 FFmpeg service
- 🚧 Media import
- 🚧 Timeline with trim
- 🚧 Preview player
- 🚧 Export to MP4

## Documentation

- [MVP PRD](docs/Axis_Pro_MVP_PRD.md) - Product requirements
- [Design Spec](docs/Axis_Pro_Design_Specification_Sheet.md) - Visual & UX guidelines
- [Task List](docs/Axis_Pro_MVP_Task_List.md) - Implementation roadmap
- [Implementation Summary](docs/Implementation_Summary.md) - Progress tracking
- [Testing Log](docs/Testing_Document.md) - Test execution records

## License

MIT

