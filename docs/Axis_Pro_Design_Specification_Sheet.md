# 🎬 Axis Pro — Project Design Specification Sheet

## Overview
**Axis Pro** is a professional-grade, minimalist desktop video editor built for speed, precision, and focus.  
It combines a streamlined UI with performance-driven architecture to deliver an efficient editing experience for creators who value flow and clarity.

---

## 🧭 Design Philosophy
**Core Idea:** Precision without Noise.

Axis Pro embodies a **Pro-Studio Minimalist** design ethos: quiet power, clear focus, zero clutter.

### Design Principles
1. **Clarity Over Decoration** — every visual element serves a purpose.  
2. **Depth Through Light, Not Color** — subtle gradients and elevation replace heavy contrast.  
3. **Responsive Weight** — elements feel alive via minimal, tactile interactions.  
4. **Native Feel** — desktop-native behaviors, fluid scrolling, instant feedback.  
5. **Speed Is Luxury** — transitions under 200 ms, no visual bloat.

---

## 🎨 Visual Language

| Element | Specification |
|----------|---------------|
| **Base Colors** | `#121212` (matte black), `#1E1E1E` (surface), `#007AFF` (macOS blue) or `#00A3FF` (cyan accent), `#F2F2F2` (text/icons) |
| **Typography** | **Primary:** SF Pro Display (macOS) → fallback Inter (cross-platform); bold headers, light body. |
| **Iconography** | Outline SVG icons (1.5 px stroke, no fills). Use Feather Icons or custom set. |
| **Shapes** | Rounded corners 6 – 8 px; soft shadows `0 2px 10px rgba(0,0,0,0.4)` |
| **Lighting** | Subtle top-down gradient dark gray → slightly darker bottom; gentle ambient depth. |
| **Motion** | Fades + slides < 200 ms; timeline scrub snaps for kinetic feedback. |

---

## 🖥️ Layout System

### Global Structure
- **Top Bar** — App title (Axis Pro), menu icons (File, Record, Import, Export).  
- **Left Panel** — Media Library (thumbnails, metadata).  
- **Center** — Preview Window with player controls.  
- **Bottom** — Timeline Editor (2 tracks minimum: main + overlay).  
- **Right Panel** — Clip Properties / Export Settings toggle.  

### Component Hierarchy
```
<AppWindow>
 ├── TopBar
 ├── MainContent
 │    ├── MediaLibrary
 │    ├── PreviewPanel
 │    └── PropertiesPanel
 └── Timeline
```

### Interaction States
- Hover: soft glow or light shift (+5% brightness).  
- Active drag: drop-shadow and slight scale (1.02×).  
- Selection: accent outline (#00A3FF or #007AFF).  
- Transitions: ease-in-out 0.15 – 0.2 s.

---

## 🧩 UX Tone & Behavior
- **Voice:** Direct verbs only — “Import Clip,” “Trim,” “Export.”  
- **Feedback:** Immediate visual confirmation for every action.  
- **Empty States:** Friendly and motivating — “Drop a clip to begin.”  
- **Focus Mode:** Hides panels for distraction-free editing.  
- **Keyboard First:** ⌘/Ctrl + E = Export, ⌘/Ctrl + I = Import, Space = Play/Pause.  

---

## ⚙️ Technical Styling Guidelines
- **Frameworks:** Electron or Tauri (front-end React recommended).  
- **Style System:** CSS variables / Tailwind theme for color and radius consistency.  
- **Dark Mode:** default state only; light mode optional later.  
- **Fonts:** System font stack (`-apple-system, Inter, sans-serif`).  
- **Transitions:** CSS `transition: all 0.2s ease-in-out;`.  

---

## 🧱 Brand Identity
| Attribute | Description |
|------------|-------------|
| **Product Name** | **Axis Pro** |
| **Tagline** | *Precision Without Noise* |
| **Brand Voice** | Confident, professional, quietly intelligent. |
| **Logo Concept** | Minimal geometric “A” symbol rotating on an axis; neutral typography below. |
| **Favicon/Icon** | Monoline “Axis A” glyph in accent blue on dark matte background. |

---

## 🧩 Example Mood References
- **UI Inspiration:** Linear.app, Final Cut Pro, Framer Desktop, VS Code.  
- **Motion Reference:** Notion panel transitions, Apple Finder smoothness.  
- **Color Energy:** Cool, professional, dimly lit studio.  

---

## 📦 Deliverables for Cursor
1. **UI components** styled according to Axis Pro specs.  
2. **Color + typography tokens** exported as theme variables.  
3. **Icon set** SVG folder (`/assets/icons/axis/`).  
4. **Design spec integration** into `README.md` and Product Requirement Document for developer reference.  

---

### ✅ Summary
Axis Pro delivers a **refined, high-performance editing environment** that looks and feels like a native macOS / Windows studio tool.  
Its design balances **precision, silence, and intent** — a workspace that helps creators stay on their axis.
