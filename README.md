# Mini-DAW

Browser-based mini DAW. **Play mode** is a Tone.js **MonoSynth** with recording into a single clip.

Repo: [toomanynates/grok-DAW](https://github.com/toomanynates/grok-DAW)

---

## Try it

1. Clone or download this repo
2. Open `index.html` (or `npx serve .`)
3. Click **Start Synth**
4. Play keys · hit **Record** · play a phrase · **Stop** · **Play** to hear the clip

---

## Features

### Play mode (Chunk 1)
| Feature | Details |
|---------|---------|
| Engine | Tone.js `MonoSynth` (CDN) |
| Oscillator | Sine / Square / Saw / Triangle |
| Filter | Low-pass cutoff + resonance |
| Amp + Filter envelopes | ADSR (+ filter base / octaves) |
| Global | Volume, Portamento, Active note, Level meter, Reset |
| Keyboard | 1 / 2 / 4 / 88 keys (4 & 88 blocked on small screens) |
| Panic | Esc or Reset |

### Recording (Chunk 2)
| Feature | Details |
|---------|---------|
| Record | Capture live notes into one clip |
| Note data | `{ pitch, start, duration, velocity }` |
| Transport | Record · Stop · Play · Clear |
| Shortcuts | `R` toggle record · `Space` play/stop |
| Playback | Schedules the clip through the same MonoSynth |

---

## Architecture

```
js/
  bind.js           # Shared SVG knobs / selects → params
  mono-synth.js     # Tone.MonoSynth wrapper
  clip-recorder.js  # Single-clip record + play (Chunk 2)
  keyboard.js       # Piano + computer keys → synth + recorder
  controls.js       # Synth panels
  transport.js      # Record/Stop/Play/Clear UI
  main.js           # Boot + Tone.start()
```

---

## Roadmap

| Chunk | Focus |
|-------|--------|
| 1 | Playable MonoSynth ✓ |
| 2 | Basic recording ✓ |
| 3 | Piano-roll note editor |
| 4 | Multitrack + Transport |
| 5 | Project save / load |
| 6 | MIDI export |
| 7 | AI Compose |
| 8+ | More instruments, effects |

---

## License

MIT
