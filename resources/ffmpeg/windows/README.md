# Windows FFmpeg Binaries

This directory should contain Windows FFmpeg binaries for packaging.

## Download Instructions

### Option 1: Gyan.dev (Recommended)

1. Visit: https://www.gyan.dev/ffmpeg/builds/
2. Download: `ffmpeg-release-essentials.zip`
3. Extract and copy these files to this directory:
   - `ffmpeg.exe`
   - `ffprobe.exe`

### Option 2: GitHub Builds

1. Visit: https://github.com/BtbN/FFmpeg-Builds/releases
2. Download: `ffmpeg-master-latest-win64-gpl.zip`
3. Extract and copy:
   - `ffmpeg.exe`
   - `ffprobe.exe`

### Directory Structure

```
resources/ffmpeg/windows/
├── ffmpeg.exe
├── ffprobe.exe
└── README.md (this file)
```

## Building for Windows

Once the binaries are in place, build the Windows installer:

```bash
npm run build:win
```

This creates: `dist/Axis Pro Setup 0.1.0.exe`

## Note for Git

The .exe files are not tracked in Git. Each developer building for Windows needs to download these binaries separately.

For automatic downloads, consider using:

- `electron-builder` hooks
- Pre-build scripts
- CI/CD pipeline downloads
