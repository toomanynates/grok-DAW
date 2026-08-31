# Mini-DAW

Browser-based mini DAW. **Play mode** is a Tone.js **MonoSynth** with a modular, token-driven UI.

**Current status:** Chunk 1 – Playable synthesizer (Play mode) at https://toomanynates.github.io/grok-DAW/

Live structure and roadmap: see [`MINI-DAW-PLAN.md`](./MINI-DAW-PLAN.md)

---

## Try it

1. Clone or download this repo
2. Open `index.html` in Chrome, Firefox, Edge, or Safari
   (or serve the folder: `npx serve .`)
3. Click **Start Synth**
4. Play

GitHub Pages (if enabled): `https://toomanynates.github.io/grok-DAW/`

---

## Features (Play mode v2)

| Feature | Details |
|---------|---------|
| Engine | **Tone.js** `MonoSynth` (CDN) |
| Oscillator | Sine / Square / Saw / Triangle |
| Filter | Low-pass cutoff + resonance |
| Amp envelope | ADSR |
| Filter envelope | ADSR + base frequency + octaves |
| Global | Volume (dB), Portamento, Active note, Level meter, Reset |
| Keyboard | 1 / 2 / 4 octaves or full **88 keys** |
| Input | On-screen keys + computer keyboard |
| Panic | **Esc** or **Reset** kills notes; Reset also restores defaults |
| Mobile | 4-octave and 88-key modes show "unavailable" on small screens |

### Computer keyboard

```
  W   E     T   Y   U
A   S   D  F   G   H   J   K
C  C#  D  D# E  F  F# G  G# A  A# B  C
```

`Z` / `X` = octave down / up · `Esc` = panic

---

## Architecture

```
index.html                 # section → container → row layout
css/styles.css             # :root tokens + BEM
js/
  bind.js                  # Reusable UI → parameter binding (SVG knobs, selects)
  mono-synth.js            # Tone.MonoSynth wrapper
  keyboard.js              # Piano + computer keys + size selector
  controls.js              # Panel builders (use Bind + MonoSynthEngine)
  main.js                  # Boot, gesture unlock (Tone.start)
```

**Design rules**
- All controls use CSS tokens (no hard-coded colors/sizes in components)
- BEM class names
- One shared **Bind** layer so future synths (FM / AM) don't reimplement knobs
- Audio starts only after a user gesture

---

## Roadmap

| Chunk | Focus |
|-------|--------|
| **1** | Playable MonoSynth (current) |
| **2** | Record notes into a clip |
| **3** | Piano-roll editor |
| **4** | Multitrack + Tone Transport |
| **5** | Project save / load |
| **6** | MIDI export |
| **7** | AI Compose (LLM → MIDI) |
| **8+** | More instruments, effects, polish |

See `MINI-DAW-PLAN.md` for full decisions.

---

## License

MIT
