# Quick Fix: "Axis Pro is damaged" Error

## ⚠️ This is NORMAL and EXPECTED

Your app is fine! macOS blocks unsigned apps by default.

---

## ✅ Solution (Choose One)

### Method 1: Right-Click to Open (Easiest)

1. Go to Applications folder
2. **Right-click** (or Control+click) on `Axis Pro.app`
3. Choose **"Open"** from menu
4. Click **"Open"** in the dialog
5. App will launch successfully
6. Future launches work normally with double-click

### Method 2: Terminal Command

```bash
xattr -cr "/Applications/Axis Pro.app"
```

Then right-click → Open

### Method 3: System Settings (macOS Ventura+)

1. Try to open app (it will be blocked)
2. System Settings → Privacy & Security
3. Click "Open Anyway" button
4. Try opening again

---

## 📝 Add This to Release Notes

**IMPORTANT:** macOS will show a "damaged" warning because the app is not code-signed. This is normal! Use the right-click method to bypass:

1. Right-click app → "Open" → "Open" again
2. Or run: `xattr -cr "/Applications/Axis Pro.app"`

You only need to do this once!

---

## Why Does This Happen?

- App is not code-signed (requires $99/year Apple Developer account)
- macOS Gatekeeper blocks unsigned apps by default
- The app is safe - source code is public on GitHub
- This is a standard security feature for all unsigned apps

---

## For Your GitHub Release Page

Add this warning box at the top of the release notes:

```markdown
> **⚠️ macOS Users:** You will see a security warning on first launch. This is normal for unsigned apps.
> 
> **Fix:** Right-click the app → "Open" → "Open" again. Or run: `xattr -cr "/Applications/Axis Pro.app"`
> 
> You only need to do this once. Future launches work normally.
```

