#!/bin/bash

# FFmpeg Setup Script for Axis Pro
# This script downloads and installs FFmpeg binaries for macOS

set -e  # Exit on error

echo "🎬 Axis Pro - FFmpeg Setup"
echo "=========================="
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ Error: This script is for macOS only"
    exit 1
fi

# Create directory if it doesn't exist
FFMPEG_DIR="resources/ffmpeg/mac"
mkdir -p "$FFMPEG_DIR"

echo "📥 Downloading FFmpeg and FFprobe..."
echo ""

# Check if Homebrew is installed
if command -v brew &> /dev/null; then
    echo "✓ Homebrew detected"
    echo "Installing FFmpeg via Homebrew..."
    
    # Install ffmpeg if not already installed
    if ! command -v ffmpeg &> /dev/null; then
        brew install ffmpeg
    else
        echo "✓ FFmpeg already installed via Homebrew"
    fi
    
    # Copy binaries
    echo "Copying binaries to resources folder..."
    cp "$(which ffmpeg)" "$FFMPEG_DIR/ffmpeg"
    cp "$(which ffprobe)" "$FFMPEG_DIR/ffprobe"
    
else
    echo "⚠️  Homebrew not found"
    echo ""
    echo "Please install FFmpeg manually:"
    echo "1. Visit: https://evermeet.cx/ffmpeg/"
    echo "2. Download both 'ffmpeg' and 'ffprobe' (7-day builds)"
    echo "3. Extract the .7z files"
    echo "4. Copy the binaries to: $FFMPEG_DIR/"
    echo "5. Run: chmod +x $FFMPEG_DIR/ffmpeg $FFMPEG_DIR/ffprobe"
    echo ""
    echo "Or install Homebrew first:"
    echo "/bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    exit 1
fi

# Make executable
chmod +x "$FFMPEG_DIR/ffmpeg"
chmod +x "$FFMPEG_DIR/ffprobe"

echo ""
echo "✅ FFmpeg installation complete!"
echo ""

# Verify installation
echo "Verifying installation..."
if ./"$FFMPEG_DIR/ffmpeg" -version > /dev/null 2>&1; then
    echo "✓ ffmpeg: OK"
else
    echo "❌ ffmpeg: FAILED"
    exit 1
fi

if ./"$FFMPEG_DIR/ffprobe" -version > /dev/null 2>&1; then
    echo "✓ ffprobe: OK"
else
    echo "❌ ffprobe: FAILED"
    exit 1
fi

echo ""
echo "🎉 Setup complete! You can now run: npm run dev"
echo ""


