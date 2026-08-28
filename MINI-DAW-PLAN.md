# Mini-DAW Project – Key Decisions & Structure

**Last updated:** 2026-08-26  
**Status:** Planning complete – ready for Chunk 1  
**Conversation:** Continue in the same chat thread to pause/resume at any time.

---

## 1. Overall Vision

A browser-based mini DAW whose first (and core) view is a playable synthesizer.

- **Play mode** = the synthesizer keyboard + controls (Chunk 1)
- Later modes expand into a lightweight multitrack environment with note editing, AI-assisted composition, project persistence, and MIDI export.

The synthesizer is treated as one instrument module. Future instruments can be added later.

---

## 2. Technology Decisions

| Area                    | Decision                                                                 | Notes |
|-------------------------|--------------------------------------------------------------------------|-------|
| Platform                | Web app (HTML + CSS + JS)                                                | Runs in modern browsers on desktop & mobile |
| Audio engine            | Native Web Audio API                                                     | No Tone.js or other audio libraries for core synth |
| Waveforms               | `sine`, `square`, `sawtooth`, `triangle` + `custom` (PeriodicWave)       | Custom left for later expansion |
| Filter                  | Low-pass (`BiquadFilterNode`)                                            | Cutoff modulatable by simple sine LFO |
| UI                      | Vanilla JS + CSS (no React/Vue/Svelte for v1)                            | Easy to keep lightweight and readable |
| CSS Architecture        | Centralized global styles + BEM methodology                              | See section 2.1 |
| HTML Structure          | Semantic sections + container / row pattern                              | Clear hierarchy for developers |
| Fonts / Icons           | Google Fonts + Font Awesome (CDN)                                        | User may later supply Font Awesome kit |
| Persistence (later)     | IndexedDB + downloadable JSON project files                              | |
| MIDI export (later)     | Pure JS MIDI writer (Type 1 multitrack)                                  | |
| AI Compose (later)      | External LLM API (user-supplied key)                                     | Online-only feature |
| File structure          | Multiple files                                                           | See section 5 |
| Code quality            | Comments + console logs for debugging & assumption validation            | |

**Not in scope for v1:** native iOS/Android apps, offline AI, complex sample-based instruments, full mixer with inserts/sends.

### 2.1 CSS & HTML Coding Standards

**CSS**
- Single centralized stylesheet (`css/styles.css`) for all global styles.
- Use `:root` custom properties for the entire color palette, spacing, typography, and other design tokens.
- Follow **BEM** (Block Element Modifier) naming:
  - Block: `.keyboard`
  - Element: `.keyboard__key`
  - Modifier: `.keyboard__key--pressed`, `.keyboard__key--black`
- No deep nesting. Prefer flat, readable selectors.
- Clear section comments inside the CSS file (e.g. `/* ===== KEYBOARD ===== */`).

**HTML**
- Semantic structure using `<section>`, `<header>`, etc.
- Layout pattern: `.section` → `.container` → `.row` → content blocks.
- This hierarchy lets any experienced developer instantly understand the page layout and safely make changes.
- Meaningful class names + HTML comments for major regions.

**JavaScript**
- Descriptive comments explaining intent, especially around Web Audio graph creation and state.
- Strategic `console.log` / `console.warn` statements to:
  - Confirm AudioContext state changes
  - Validate note on/off
  - Show current octave, waveform, filter values when changed
  - Aid debugging without being noisy in production (can be gated later).

---

## 3. Visual & UX Direction

- **Style:** Dark, minimal, elegant, futuristic
- **Keyboard:** 
  - Horizontal orientation → 2 octaves
  - Vertical orientation → 1 octave
  - Responsive via CSS media queries + ResizeObserver
- **Feedback:** Pressed keys light up
- **Audio start:** Only after first user gesture (click / tap / key) – required by browsers
- **Meter:** Simple level meter (AnalyserNode → canvas or div-based)
- **Knobs:** Clean, modern rotary controls (CSS + pointer events)

---

## 4. Chunking Plan (Build Order)

We build **one chunk at a time**. Each chunk is fully playable/usable before moving on.

### Chunk 1 – Playable Synth (Play Mode)          ← NEXT
- On-screen piano keyboard (responsive 1 / 2 octaves)
- Computer keyboard mapping
- Waveform selector (sine / square / sawtooth / triangle)
- Low-pass filter with cutoff + resonance knobs
- Simple sine LFO that can modulate filter cutoff (rate + depth)
- Envelope (Attack / Decay / Sustain / Release) knobs
- Octave shift (+ / –)
- Master volume
- Simple level meter
- Key highlighting on press
- AudioContext created/resumed only after user gesture
- Dark minimal elegant futuristic UI
- Google Fonts + Font Awesome
- **Centralized CSS** with `:root` variables + strict BEM
- **Semantic HTML** using section → container → row structure
- Code comments throughout + console logs for debugging / assumption checks

### Chunk 2 – Basic Recording
- Record button
- Capture live notes from the keyboard into a single clip (pitch, start time, duration, velocity)

### Chunk 3 – Piano-Roll Note Editor
- Visual grid (time × pitch)
- Create / move / resize / delete notes
- Velocity editing
- Basic quantize
- Zoom & scroll
- Undo / redo

### Chunk 4 – Multitrack Skeleton + Shared Transport
- Multiple tracks
- Mute / Solo / Arm
- Shared play / stop / record / loop / tempo
- Simultaneous playback of multiple tracks

### Chunk 5 – Project Save / Load
- Serialize entire project to JSON
- IndexedDB persistence
- Download / upload `.json` project files

### Chunk 6 – MIDI Export
- Export multitrack MIDI (Type 1) file

### Chunk 7 – AI Compose Module
- Prompt or preset → LLM → MIDI-like note data
- User supplies their own LLM API key
- Insert generated loops into clips

### Chunk 8+ – Polish & Expansion
- More instruments, effects, mobile refinements, automation, etc.

---

## 5. Proposed File Structure (Chunk 1)

```
/home/workdir/artifacts/
├── index.html              # Semantic sections + container/row structure
├── css/
│   └── styles.css          # SINGLE centralized stylesheet
│                           # :root design tokens + BEM + section comments
├── js/
│   ├── main.js             # Entry point, UI wiring, gesture unlock, console logs
│   ├── synth-engine.js     # Web Audio graph (osc, filter, envelope, LFO, meter)
│   ├── keyboard.js         # On-screen + computer keyboard handling
│   └── ui-controls.js      # Knobs, selectors, octave, volume, meter drawing
├── MINI-DAW-PLAN.md        # This document
└── README.md               # Short project overview (created later)
```

Later chunks will add folders such as `js/editor/`, `js/multitrack/`, `js/project/`, etc.

---

## 6. Synth Engine – Key Technical Notes (Chunk 1)

- One `AudioContext` (created on first gesture)
- Voice architecture: simple monophonic or lightly polyphonic (decide at implementation – start mono or 4–6 voices)
- Signal flow (per voice):
  `Oscillator` → `Filter (low-pass)` → `Gain (envelope)` → Master Gain → Destination
- LFO (sine) can be connected to filter cutoff
- Envelope: classic ADSR using `AudioParam` automation or a small custom envelope generator
- AnalyserNode for the level meter
- All parameters exposed as knobs / selectors in the UI

---

## 7. Computer Keyboard Mapping (Initial Proposal)

```
A W S E D F T G Y H U J K     ← white & black keys (one octave)
Z X                           ← octave down / up
```

Exact mapping can be adjusted during Chunk 1 implementation. On-screen keys will also show the mapped letter.

---

## 8. Future-Proofing Hooks

- Instrument interface so new sound generators can be swapped in
- Note data format that is already MIDI-like (pitch, start, duration, velocity)
- Shared transport / clock that can drive multiple instruments
- Clear separation between UI and audio engine

---

## 9. How to Pause & Resume

1. Keep using **this same conversation thread**.
2. When you return, just say something like:  
   “Continuing the mini-DAW project – ready for Chunk 1”  
   or  
   “We finished Chunk X, let’s start Chunk Y”.
3. Full context is retained in the thread.

You can also copy this entire document into a local file or GitHub repo for your own records.

---

## 10. Immediate Next Step

**Chunk 1 implementation** – the playable synthesizer.

When you say “go” (or “start Chunk 1”), we will:

1. Create the file structure above
2. Build the dark futuristic UI
3. Implement the Web Audio synth engine
4. Wire keyboard (screen + computer)
5. Add all knobs, meter, octave, waveform, filter + LFO, envelope
6. Ensure audio starts only after user gesture
7. Make the keyboard responsive (1 octave vertical / 2 octaves horizontal)

---

**Ready for Chunk 1 when you are.**
