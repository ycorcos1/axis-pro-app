# Axis Pro - Installation Troubleshooting

## macOS Issues

### Error: "Axis Pro is damaged and can't be opened"

This is macOS Gatekeeper blocking unsigned applications. **This is expected and normal.**

**Solution 1: Right-Click Method (Recommended)**

1. Do NOT double-click the app
2. **Right-click** (or Control+click) on `Axis Pro.app`
3. Choose **"Open"** from the context menu
4. Click **"Open"** in the security dialog
5. The app will launch successfully
6. Future launches will work with normal double-click

**Solution 2: Remove Quarantine Attribute**

If the right-click method doesn't work, use Terminal:

```bash
# Remove quarantine from the app
xattr -cr "/Applications/Axis Pro.app"
```

Then try right-clicking → Open again.

**Solution 3: System Settings (macOS Ventura+)**

1. Try to open the app (it will be blocked)
2. Go to **System Settings** → **Privacy & Security**
3. Scroll down to find message about "Axis Pro"
4. Click **"Open Anyway"**
5. Try opening the app again

---

### Error: "Axis Pro cannot be opened because the developer cannot be verified"

Same as above - use the right-click method or Terminal command.

---

### Why does this happen?

- Axis Pro is not code-signed with an Apple Developer ID
- macOS Gatekeeper blocks unsigned apps by default
- This is a security feature to protect against malware
- The app is safe, but you need to explicitly allow it

**For distribution:** Code signing requires a paid Apple Developer account ($99/year) and is planned for future releases.

---

### App launches but videos won't import

**Check FFmpeg:**

The app needs FFmpeg binaries. If you built from source, ensure:

```bash
# Check if FFmpeg exists
ls -la "/Applications/Axis Pro.app/Contents/Resources/ffmpeg/mac/"

# Should show:
# ffmpeg
# ffprobe
```

If missing, you may have downloaded a development build. Download the official release from GitHub.

---

### App won't launch at all (crash on startup)

1. **Check Console.app** for error messages:

   - Open Console.app
   - Search for "Axis Pro"
   - Look for crash logs

2. **Check architecture compatibility:**

   - The macOS build is for Apple Silicon (M1/M2/M3)
   - Intel Macs are not currently supported
   - Check: Apple menu → About This Mac → Chip

3. **Try deleting preferences:**
   ```bash
   rm -rf ~/Library/Application\ Support/axis-pro-app
   ```
   Then launch again

---

## Windows Issues

### Windows Defender SmartScreen Warning

Windows may show a warning: "Windows protected your PC"

**Solution:**

1. Click **"More info"**
2. Click **"Run anyway"**
3. The installer will proceed

This happens because the app is not signed with a Windows code signing certificate.

---

### Video import not working (Windows)

**Check FFmpeg binaries:**

The Windows build requires FFmpeg. If you built from source:

1. Download FFmpeg from [gyan.dev/ffmpeg/builds](https://www.gyan.dev/ffmpeg/builds/)
2. Extract `ffmpeg.exe` and `ffprobe.exe`
3. Place in `resources/ffmpeg/windows/`
4. Rebuild: `npm run build:win`

Official releases include FFmpeg pre-bundled.

---

## General Issues

### Projects won't save

Check disk permissions:

**macOS:**

```bash
ls -la ~/Library/Application\ Support/axis-pro-app/
```

**Windows:**

```cmd
dir "%APPDATA%\axis-pro-app"
```

Ensure the directory is writable.

---

### Thumbnails not generating

This means FFmpeg is not working. See FFmpeg troubleshooting above.

---

### Performance is slow

- **Close other video applications**
- **Check available RAM** (app needs ~500MB+)
- **Use SSD storage** for projects (not external USB 2.0 drives)
- **4K videos** require more processing power

---

### Can't export videos

1. **Check disk space** (exports need free space equal to output size)
2. **Check FFmpeg** (same as import troubleshooting)
3. **Try a shorter trim** (30 seconds) to test
4. **Check Console/logs** for error messages

---

## Still Having Issues?

1. **Check the Console** (macOS) or **Event Viewer** (Windows) for detailed errors
2. **Open an issue** on GitHub with:
   - Your OS version
   - Error messages
   - Steps to reproduce
   - Console/log output

---

## Known Limitations

- **macOS only supports Apple Silicon** (M1/M2/M3) currently
- **No Intel Mac builds** available yet
- **App is unsigned** (requires security bypass on first launch)
- **Large 4K videos** (>10GB) may be slow to process
- **No GPU acceleration** yet (CPU encoding only)

---

## Security Note

**Is this safe despite the warnings?**

Yes! The security warnings appear because:

- The app is not code-signed (requires $99/year Apple Developer account)
- Source code is public on GitHub (you can audit it)
- Built from open-source Electron + React + FFmpeg

The warnings are macOS/Windows being cautious, not indicating actual malware.
