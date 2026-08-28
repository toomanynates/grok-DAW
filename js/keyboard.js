/**
 * keyboard.js
 * On-screen piano keyboard + computer keyboard mapping.
 *
 * Builds a continuous 2-octave keyboard (C → C).
 * Upper-octave keys get .keyboard__key--upper and are hidden
 * on portrait / narrow viewports (1 octave visible).
 *
 * Computer mapping (relative to current base octave C):
 *   White: A S D F G H J K
 *   Black: W E   T Y U
 *   Octave: Z (down)  X (up)
 *   Panic:  Escape
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

  // White-key semitone offsets from C within one octave
  const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B

  // Black keys: semitone from C + index of the white key they sit after
  const BLACK_DEFS = [
    { offset: 1, afterWhite: 0 }, // C# after C
    { offset: 3, afterWhite: 1 }, // D# after D
    { offset: 6, afterWhite: 3 }, // F# after F
    { offset: 8, afterWhite: 4 }, // G# after G
    { offset: 10, afterWhite: 5 } // A# after A
  ];

  /**
   * MIDI number of C in a given octave number.
   * Scientific pitch: C4 = 60, C3 = 48, etc.
   */
  function cMidi(octave) {
    return octave * 12 + 12;
  }

  /**
   * Build the full 2-octave keyboard (15 white keys: C..C, 10 black keys).
   * Upper-octave keys receive .keyboard__key--upper for responsive hiding.
   */
  function rebuild() {
    if (!keysContainer) return;

    keyElements.clear();
    keysContainer.innerHTML = "";

    const baseOctave = SynthEngine.getBaseOctave();
    const baseMidi = cMidi(baseOctave); // leftmost C

    // ----- White keys: 15 keys covering C → C across two octaves -----
    // Indices 0–6  = base octave C..B
    // Indices 7–13 = next octave C..B
    // Index 14     = final C (two octaves above base)
    const whiteEls = [];
    const totalWhite = 15;

    for (let i = 0; i < totalWhite; i++) {
      let midi;
      if (i === 14) {
        midi = baseMidi + 24; // top C
      } else {
        const oct = Math.floor(i / 7);       // 0 or 1
        const whiteInOct = i % 7;            // 0..6
        midi = baseMidi + oct * 12 + WHITE_OFFSETS[whiteInOct];
      }

      const el = document.createElement("div");
      el.className = "keyboard__key keyboard__key--white";
      if (i >= 7) {
        el.classList.add("keyboard__key--upper");
      }
      el.dataset.midi = String(midi);

      const label = document.createElement("span");
      label.className = "keyboard__key-label";
      if (i < 7) {
        const semi = WHITE_OFFSETS[i];
        if (LABEL_MAP[semi] !== undefined) {
          label.textContent = LABEL_MAP[semi];
        }
      } else if (i === 7) {
        label.textContent = "K"; // computer key for the C one octave up
      }
      el.appendChild(label);

      keysContainer.appendChild(el);
      whiteEls.push(el);
      keyElements.set(midi, el);
    }

    // ----- Black keys (positioned from real white-key geometry) -----
    requestAnimationFrame(() => {
      positionBlackKeys(whiteEls, baseMidi);
      console.log(
        "[KeyboardUI] Rebuilt. baseOctave =",
        baseOctave,
        "leftmost MIDI =",
        baseMidi,
        "(C)  keys =",
        keyElements.size
      );
    });
  }

  /**
   * Place black keys using each white key's actual offsetLeft / width.
   * This stays correct even when the flex row is centered.
   */
  function positionBlackKeys(whiteEls, baseMidi) {
    if (!whiteEls.length) return;

    const containerRect = keysContainer.getBoundingClientRect();
    if (containerRect.width === 0) return;

    // Remove any previous black keys (in case of rapid rebuilds)
    keysContainer.querySelectorAll(".keyboard__key--black").forEach((el) => {
      const m = parseInt(el.dataset.midi, 10);
      keyElements.delete(m);
      el.remove();
    });

    for (let oct = 0; oct < 2; oct++) {
      BLACK_DEFS.forEach(({ offset, afterWhite }) => {
        const whiteIndex = oct * 7 + afterWhite;
        const whiteEl = whiteEls[whiteIndex];
        if (!whiteEl) return;

        // Skip upper black keys if that white key is hidden (portrait)
        if (oct === 1 && whiteEl.classList.contains("keyboard__key--upper")) {
          const style = window.getComputedStyle(whiteEl);
          if (style.display === "none") return;
        }

        const midi = baseMidi + oct * 12 + offset;
        const el = document.createElement("div");
        el.className = "keyboard__key keyboard__key--black";
        if (oct === 1) {
          el.classList.add("keyboard__key--upper");
        }
        el.dataset.midi = String(midi);

        const whiteRect = whiteEl.getBoundingClientRect();
        const whiteWidth = whiteRect.width;
        const blackWidth = Math.min(40, whiteWidth * 0.62);

        // Center the black key on the right edge of this white key
        // (i.e. on the boundary between this white key and the next)
        const leftInContainer =
          whiteRect.left - containerRect.left + whiteWidth - blackWidth / 2;

        el.style.left = `${leftInContainer}px`;
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

      if (e.key === "Escape") {
        e.preventDefault();
        panic();
        return;
      }

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

      const midi = cMidi(SynthEngine.getBaseOctave()) + KEY_MAP[key];
      press(midi);
    });

    window.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      if (KEY_MAP[key] === undefined) return;

      const midi = cMidi(SynthEngine.getBaseOctave()) + KEY_MAP[key];
      release(midi);
    });

    // Safety net: losing focus releases everything
    window.addEventListener("blur", () => {
      panic();
    });
  }

  /**
   * Immediately silence every voice and clear visual pressed state.
   */
  function panic() {
    console.log("[KeyboardUI] panic – killing all notes");
    pressed.forEach((midi) => {
      const el = keyElements.get(midi);
      if (el) el.classList.remove("keyboard__key--pressed");
    });
    pressed.clear();
    SynthEngine.allNotesOff();
  }

  function changeOctave(delta) {
    const current = SynthEngine.getBaseOctave();
    const next = Math.max(0, Math.min(6, current + delta));
    if (next === current) return;

    panic();
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
    release,
    panic
  };
})();
