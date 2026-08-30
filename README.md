# Mini-DAW

A browser-based mini digital audio workstation, built one chunk at a time.

**Current status:** Chunk 1 – Playable synthesizer (Play mode) at https://toomanynates.github.io/grok-DAW/

Live structure and roadmap: see [`MINI-DAW-PLAN.md`](./MINI-DAW-PLAN.md)

---

## Try it

1. Clone or download this repo
2. Open `index.html` in a modern browser (Chrome, Firefox, Edge, or Safari)
3. Click **Start Synth** (browsers require a user gesture before audio can start)
4. Play

> **Tip:** For the best experience serve the folder over HTTP  
> (e.g. `npx serve .` or VS Code Live Server). Opening via `file://` works in most desktop browsers but can be restricted on mobile.

### GitHub Pages

If Pages is enabled on this repo the synth is also available at:

`https://toomanynates.github.io/grok-DAW/`

---

## Features (Chunk 1)

| Feature | Details |
|---------|---------|
| On-screen keyboard | Responsive: **1 octave** in portrait / narrow view, **2 octaves** in landscape |
| Computer keyboard | `A S D F G H J K` (white) · `W E T Y U` (black) · `Z` / `X` octave |
| Waveforms | Sine, Square, Sawtooth, Triangle |
| Filter | Low-pass with Cutoff + Resonance |
| LFO | Sine LFO modulating filter cutoff (Rate + Depth) |
| Envelope | ADSR (Attack, Decay, Sustain, Release) |
| Global | Octave shift, Volume, Level meter |
| Panic / Reset | **Esc** or **Reset** button kills all notes; Reset also restores defaults |
| Audio unlock | Starts only after an explicit user gesture |

---

## Keyboard map

```
  W   E     T   Y   U
A   S   D  F   G   H   J   K
C  C#  D  D# E  F  F# G  G# A  A# B  C
```

| Key | Action |
|-----|--------|
| `Z` | Octave down |
| `X` | Octave up |
| `Esc` | Kill all sounding notes (panic) |
| Reset button | Panic + restore every control to its default |

---

## Project structure

```
├── index.html          # Semantic layout (section → container → row)
├── css/
│   └── styles.css      # Single stylesheet – :root tokens + BEM
├── js/
│   ├── main.js         # Entry point, gesture unlock, status
│   ├── synth-engine.js # Web Audio graph (osc, filter, LFO, ADSR, meter)
│   ├── keyboard.js     # On-screen + computer keyboard
│   └── ui-controls.js  # Knobs, waveform selector, reset, meter
├── MINI-DAW-PLAN.md    # Full product plan & chunk roadmap
└── README.md
```

### Coding conventions

- **CSS:** centralized file, `:root` design tokens, strict BEM
- **HTML:** clear `section` → `.container` → `.row` hierarchy
- **JS:** comments + `console.log`s for debugging and assumption checks
- **Audio:** native Web Audio API only (no Tone.js in Chunk 1)

---

## Roadmap

| Chunk | Focus |
|-------|--------|
| **1** | Playable synth (current) |
| **2** | Record notes into a clip |
| **3** | Piano-roll note editor |
| **4** | Multitrack + shared transport |
| **5** | Project save / load (JSON + IndexedDB) |
| **6** | Multitrack MIDI export |
| **7** | AI Compose (LLM → MIDI loops, user API key) |
| **8+** | More instruments, effects, polish |

---

## Development notes

- Stuck notes: press **Esc** or click **Reset**. The engine also releases all voices when the window loses focus.
- Knobs: click and drag vertically (or use arrow keys when focused).
- Console: open DevTools to see AudioContext state, note on/off, and parameter changes.

---

## License

MIT – use freely, attribution appreciated but not required.
