/**
 * keyboard.js
 * On-screen piano keyboard + computer keyboard mapping.
 *
 * Builds a continuous 2-octave keyboard.
 * On narrow / portrait viewports the upper octave keys are hidden via CSS
 * so the user sees 1 octave; landscape / wider shows both.
 *
 * Computer mapping (relative to current base octave C):
 *   White: A S D F G H J K
 *   Black: W E   T Y U
 *   Octave: Z (down)  X (up)
 */

const KeyboardUI = (function () {
  "use strict";

  let keysContainer = null;

  // midi → DOM element
  const keyElements = new Map();

  // Currently pressed MIDI notes
  const pressed = new Set();

  // Computer key → semitone offset from C of the base octave
  const KEY_MAP = {
    a: 0,  // C
    s: 2,  // D
    d: 4,  // E
    f: 5,  // F
    g: 7,  // G
    h: 9,  // A
    j: 11, // B
    k: 12, // C (next octave)

    w: 1,  // C#
    e: 3,  // D#
    t: 6,  // F#
    y: 8,  // G#
    u: 10  // A#
  };

  const LABEL_MAP = {
    0: "A", 1: "W", 2: "S", 3: "E", 4: "D",
    5: "F", 6: "T", 7: "G", 8: "Y", 9: "H",
    10: "U", 11: "J", 12: "K"
  };

  // White-key offsets within an octave (from C)
  const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];

  // Black keys: offset from C + which white-key index they sit after
  const BLACK_DEFS = [
    { offset: 1, afterWhite: 0 }, // C#
    { offset: 3, afterWhite: 1 }, // D#
    { offset: 6, afterWhite: 3 }, // F#
    { offset: 8, afterWhite: 4 }, // G#
    { offset: 10, afterWhite: 5 } // A#
  ];

  /**
   * Build the full 2-octave keyboard (24 white + 10 black keys).
   * Upper octave keys receive the class keyboard__key--upper
   * so CSS can hide them on portrait / narrow screens.
   */
  function rebuild() {
    if (!keysContainer) return;

    keyElements.clear();
    keysContainer.innerHTML = "";

    const baseOctave = SynthEngine.getBaseOctave();
    // MIDI number of C in the base octave (C3 = 48, C4 = 60 …)
    const baseMidi = baseOctave * 12 + 12;

    // ----- White keys (2 octaves = 14 keys, last is the top C) -----
    const whiteEls = [];

    for (let oct = 0; oct < 2; oct++) {
      WHITE_OFFSETS.forEach((semi, whiteIdx) => {
        // Skip the final B of the upper octave? No – we want C to C (15 white positions? )
        // Standard 2-octave span: C3 … B3 + C4 … C5 → 15 white keys
        // For simplicity we do C..B (7) + C..B (7) + final C = 15 white keys
      });
    }

    // Cleaner: 15 white keys covering C to C across two octaves
    const totalWhite = 15; // C D E F G A B C D E F G A B C
    for (let i = 0; i < totalWhite; i++) {
      const octaveIndex = Math.floor(i / 7);       // 0 or 1 (the final C is octave 2 visually)
      const whiteInOct = i % 7;
      const semi = WHITE_OFFSETS[whiteInOct];
      // For the very last key (i === 14) it is the C of base+2
      let midi;
      if (i === 14) {
        midi = baseMidi + 24;
      } else {
        midi = baseMidi + octaveIndex * 12 + semi;
      }

      const el = document.createElement("div");
      el.className = "keyboard__key keyboard__key--white";
      if (i >= 7) {
        el.classList.add("keyboard__key--upper"); // second octave + final C
      }
      el.dataset.midi = midi;

      const label = document.createElement("span");
      label.className = "keyboard__key-label";
      // Label only the first octave computer-key hints
      if (i < 7 && LABEL_MAP[semi] !== undefined) {
        label.textContent = LABEL_MAP[semi];
      } else if (i === 7) {
        label.textContent = "K"; // the C that computer key K plays
      }
      el.appendChild(label);

      keysContainer.appendChild(el);
      whiteEls.push(el);
      keyElements.set(midi, el);
    }

    // ----- Black keys -----
    // Position after layout so we know white-key widths
    requestAnimationFrame(() => {
      const firstWhite = whiteEls[0];
      if (!firstWhite) return;

      const whiteWidth = firstWhite.getBoundingClientRect().width;
      if (whiteWidth === 0) return;

      const blackWidth = Math.min(40, whiteWidth * 0.62);

      // Two octaves of black keys
      for (let oct = 0; oct < 2; oct++) {
        BLACK_DEFS.forEach(({ offset, afterWhite }) => {
          const midi = baseMidi + oct * 12 + offset;
          const el = document.createElement("div");
          el.className = "keyboard__key keyboard__key--black";
          if (oct === 1) {
            el.classList.add("keyboard__key--upper");
          }
          el.dataset.midi = midi;

          // Absolute position relative to the keys container
          // afterWhite is the index of the white key that sits to the left
          const whiteIndex = oct * 7 + afterWhite;
          const left = (whiteIndex + 1) * whiteWidth - blackWidth / 2;
          el.style.left = `${left}px`;
          el.style.width = `${blackWidth}px`;

          const label = document.createElement("span");
          label.className = "keyboard__key-label";
          if (oct === 0 && LABEL_MAP[offset]) {
            label.textContent = LABEL_MAP[offset];
          }
          el.appendChild(label);

          keysContainer.appendChild(el);
          keyElements.set(midi, el);
        });
      }

      console.log(
        "[KeyboardUI] Rebuilt. baseOctave =",
        baseOctave,
        "keys =",
        keyElements.size
      );
    });
  }

  function press(midi) {
    if (pressed.has(midi)) return;
    pressed.add(midi);

    const el = keyElements.get(midi);
    if (el) el.classList.add("keyboard__key--pressed");

    SynthEngine.noteOn(midi);
  }

  function release(midi) {
    if (!pressed.has(midi)) return;
    pressed.delete(midi);

    const el = keyElements.get(midi);
    if (el) el.classList.remove("keyboard__key--pressed");

    SynthEngine.noteOff(midi);
  }

  function bindPointerEvents() {
    keysContainer.addEventListener("pointerdown", (e) => {
      const keyEl = e.target.closest(".keyboard__key");
      if (!keyEl) return;
      e.preventDefault();
      const midi = parseInt(keyEl.dataset.midi, 10);
      keyEl.setPointerCapture(e.pointerId);
      press(midi);
    });

    keysContainer.addEventListener("pointerup", (e) => {
      const keyEl = e.target.closest(".keyboard__key");
      if (!keyEl) return;
      const midi = parseInt(keyEl.dataset.midi, 10);
      release(midi);
    });

    keysContainer.addEventListener("pointercancel", (e) => {
      const keyEl = e.target.closest(".keyboard__key");
      if (!keyEl) return;
      const midi = parseInt(keyEl.dataset.midi, 10);
      release(midi);
    });
  }

  function bindComputerKeyboard() {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();

      if (key === "z") {
        e.preventDefault();
        changeOctave(-1);
        return;
      }
      if (key === "x") {
        e.preventDefault();
        changeOctave(1);
        return;
      }

      if (KEY_MAP[key] === undefined) return;
      e.preventDefault();

      const baseMidi = SynthEngine.getBaseOctave() * 12 + 12;
      const midi = baseMidi + KEY_MAP[key];
      press(midi);
    });

    window.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      if (KEY_MAP[key] === undefined) return;

      const baseMidi = SynthEngine.getBaseOctave() * 12 + 12;
      const midi = baseMidi + KEY_MAP[key];
      release(midi);
    });
  }

  function changeOctave(delta) {
    const current = SynthEngine.getBaseOctave();
    const next = Math.max(0, Math.min(6, current + delta));
    if (next === current) return;

    // Release held notes
    pressed.forEach((m) => SynthEngine.noteOff(m, true));
    pressed.clear();

    SynthEngine.setBaseOctave(next);
    rebuild();
    updateOctaveDisplay();
  }

  function updateOctaveDisplay() {
    const el = document.getElementById("octave-display");
    if (!el) return;
    const base = SynthEngine.getBaseOctave();
    el.textContent = `Oct ${base}–${base + 1}`;
  }

  function init() {
    keysContainer = document.getElementById("keyboard-keys");
    if (!keysContainer) {
      console.error("[KeyboardUI] #keyboard-keys not found");
      return;
    }

    rebuild();
    bindPointerEvents();
    bindComputerKeyboard();
    updateOctaveDisplay();

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        console.log("[KeyboardUI] Resize – rebuilding layout");
        rebuild();
      }, 120);
    });

    console.log("[KeyboardUI] Initialized");
  }

  return {
    init,
    changeOctave,
    updateOctaveDisplay,
    press,
    release
  };
})();
