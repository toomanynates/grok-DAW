/**
 * keyboard.js
 * On-screen piano + computer keyboard → MonoSynthEngine.
 *
 * Sizes: 1 / 2 / 4 octaves, or full 88 keys.
 * On narrow viewports, 4 and 88 are disabled with a message.
 */

const KeyboardUI = (function () {
  "use strict";

  let keysContainer = null;
  let scrollEl = null;
  let sizeMsgEl = null;

  const keyElements = new Map(); // midi → element
  const pressed = new Set();

  // Computer keys → semitone offset from C of current base octave
  const KEY_MAP = {
    a: 0, s: 2, d: 4, f: 5, g: 7, h: 9, j: 11, k: 12,
    w: 1, e: 3, t: 6, y: 8, u: 10
  };

  const LABEL_MAP = {
    0: "A", 1: "W", 2: "S", 3: "E", 4: "D",
    5: "F", 6: "T", 7: "G", 8: "Y", 9: "H",
    10: "U", 11: "J", 12: "K"
  };

  const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
  const BLACK_DEFS = [
    { offset: 1, afterWhite: 0 },
    { offset: 3, afterWhite: 1 },
    { offset: 6, afterWhite: 3 },
    { offset: 8, afterWhite: 4 },
    { offset: 10, afterWhite: 5 }
  ];

  // State
  let baseOctave = 3;       // C3 for 1/2/4 octave modes
  let octaveCount = 2;      // 1 | 2 | 4 | 88
  let activeNoteName = "—";

  const SMALL_MAX_WIDTH = 720; // below this, 4 & 88 blocked

  function cMidi(oct) {
    return oct * 12 + 12; // C3 = 48
  }

  function isSmallScreen() {
    return window.matchMedia(`(max-width: ${SMALL_MAX_WIDTH}px), (orientation: portrait)`).matches;
  }

  /**
   * Range of MIDI notes to render for current size.
   */
  function noteRange() {
    if (octaveCount === 88) {
      // A0 (21) .. C8 (108)
      return { start: 21, end: 108 };
    }
    const start = cMidi(baseOctave);
    const end = start + octaveCount * 12; // inclusive top C
    return { start, end };
  }

  function rebuild() {
    if (!keysContainer) return;
    keyElements.clear();
    keysContainer.innerHTML = "";

    const { start, end } = noteRange();
    const whiteEls = [];

    // Collect white-key midis in range
    const whiteMidis = [];
    for (let m = start; m <= end; m++) {
      const pc = m % 12;
      if (WHITE_OFFSETS.includes(pc)) whiteMidis.push(m);
    }

    whiteMidis.forEach((midi, i) => {
      const el = document.createElement("div");
      el.className = "keyboard__key keyboard__key--white";
      el.dataset.midi = String(midi);

      const label = document.createElement("span");
      label.className = "keyboard__key-label";
      // Label computer keys only for first octave of non-88 mode
      if (octaveCount !== 88) {
        const offsetFromBase = midi - cMidi(baseOctave);
        if (offsetFromBase >= 0 && offsetFromBase <= 12 && LABEL_MAP[offsetFromBase] !== undefined) {
          label.textContent = LABEL_MAP[offsetFromBase];
        }
      } else if (midi % 12 === 0) {
        // Show C octave numbers on 88-key
        label.textContent = "C" + Math.floor(midi / 12 - 1);
      }
      el.appendChild(label);

      keysContainer.appendChild(el);
      whiteEls.push({ el, midi });
      keyElements.set(midi, el);
    });

    requestAnimationFrame(() => positionBlackKeys(whiteEls, start, end));
    updateOctaveDisplay();
    console.log("[KeyboardUI] rebuild size=", octaveCount, "range", start, "–", end, "whites", whiteEls.length);
  }

  function positionBlackKeys(whiteEls, start, end) {
    if (!whiteEls.length || !keysContainer) return;

    const containerRect = keysContainer.getBoundingClientRect();
    if (containerRect.width === 0) return;

    // Index whites by midi for lookup
    const whiteByMidi = new Map(whiteEls.map((w) => [w.midi, w.el]));

    for (let midi = start; midi <= end; midi++) {
      const pc = midi % 12;
      const blackDef = BLACK_DEFS.find((b) => b.offset === pc);
      if (!blackDef) continue;

      // Previous white key (black keys sit on the boundary after a white key)
      let prevWhite = midi - 1;
      while (prevWhite >= start && !whiteByMidi.has(prevWhite)) prevWhite--;
      const whiteEl = whiteByMidi.get(prevWhite);
      if (!whiteEl) continue;

      const el = document.createElement("div");
      el.className = "keyboard__key keyboard__key--black";
      el.dataset.midi = String(midi);

      const whiteRect = whiteEl.getBoundingClientRect();
      const whiteWidth = whiteRect.width;
      const blackWidth = Math.min(36, whiteWidth * 0.6);
      const left = whiteRect.left - containerRect.left + whiteWidth - blackWidth / 2;

      el.style.left = `${left}px`;
      el.style.width = `${blackWidth}px`;

      const label = document.createElement("span");
      label.className = "keyboard__key-label";
      if (octaveCount !== 88) {
        const offsetFromBase = midi - cMidi(baseOctave);
        if (LABEL_MAP[offsetFromBase]) label.textContent = LABEL_MAP[offsetFromBase];
      }
      el.appendChild(label);

      keysContainer.appendChild(el);
      keyElements.set(midi, el);
    }
  }

  // ----- Note press / release (monophonic with optional portamento) -----
  function press(midi) {
    if (pressed.has(midi)) return;

    // Clear visual state on any previously held keys (mono = one at a time)
    pressed.forEach((m) => {
      const el = keyElements.get(m);
      if (el) el.classList.remove("keyboard__key--pressed");
    });
    pressed.clear();
    pressed.add(midi);

    const el = keyElements.get(midi);
    if (el) el.classList.add("keyboard__key--pressed");

    // triggerAttack while already sounding enables portamento glide
    const name = MonoSynthEngine.noteOn(midi);
    activeNoteName = name || Tone.Frequency(midi, "midi").toNote();
    updateActiveNoteDisplay();

    // Feed recorder when armed (Chunk 2)
    if (typeof ClipRecorder !== "undefined") {
      ClipRecorder.noteOn(midi, 0.85);
    }
  }

  function release(midi) {
    if (!pressed.has(midi)) return;
    pressed.delete(midi);
    const el = keyElements.get(midi);
    if (el) el.classList.remove("keyboard__key--pressed");

    // Release only when the last held key lifts
    if (pressed.size === 0) {
      MonoSynthEngine.noteOff();
      activeNoteName = "—";
      updateActiveNoteDisplay();
    }

    if (typeof ClipRecorder !== "undefined") {
      ClipRecorder.noteOff(midi);
    }
  }

  function panic() {
    console.log("[KeyboardUI] panic");
    pressed.forEach((midi) => {
      const el = keyElements.get(midi);
      if (el) el.classList.remove("keyboard__key--pressed");
    });
    pressed.clear();
    MonoSynthEngine.allNotesOff();
    activeNoteName = "—";
    updateActiveNoteDisplay();

    if (typeof ClipRecorder !== "undefined") {
      ClipRecorder.onPanic();
    }
  }

  function updateActiveNoteDisplay() {
    const el = document.getElementById("active-note-value");
    if (el) el.textContent = activeNoteName;
  }

  function updateOctaveDisplay() {
    const el = document.getElementById("octave-display");
    if (!el) return;
    if (octaveCount === 88) {
      el.textContent = "A0–C8";
    } else {
      el.textContent = `Oct ${baseOctave}–${baseOctave + octaveCount - 1}`;
    }
  }

  // ----- Size selector -----
  function setOctaveCount(n) {
    n = Number(n);
    if (![1, 2, 4, 88].includes(n)) return;

    // All sizes allowed; keyboard__scroll handles overflow on small screens
    showSizeMessage(false);

    octaveCount = n;
    document.querySelectorAll(".kb-size__btn").forEach((btn) => {
      btn.classList.toggle("kb-size__btn--active", Number(btn.dataset.octaves) === n);
    });

    panic();
    rebuild();
  }

  function showSizeMessage(visible) {
    if (!sizeMsgEl) return;
    sizeMsgEl.classList.toggle("kb-size__msg--visible", visible);
  }

  function updateSizeButtonStates() {
    // No longer disable 4 / 88 on small screens — horizontal scroll is available
    document.querySelectorAll(".kb-size__btn").forEach((btn) => {
      btn.classList.remove("kb-size__btn--disabled");
      btn.disabled = false;
    });
    showSizeMessage(false);
  }

  function changeOctave(delta) {
    if (octaveCount === 88) return; // fixed range
    const next = Math.max(0, Math.min(6, baseOctave + delta));
    if (next === baseOctave) return;
    panic();
    baseOctave = next;
    rebuild();
  }

  // ----- Events -----
  function bindPointer() {
    keysContainer.addEventListener("pointerdown", (e) => {
      const keyEl = e.target.closest(".keyboard__key");
      if (!keyEl) return;
      e.preventDefault();
      keyEl.setPointerCapture(e.pointerId);
      press(parseInt(keyEl.dataset.midi, 10));
    });
    keysContainer.addEventListener("pointerup", (e) => {
      const keyEl = e.target.closest(".keyboard__key");
      if (!keyEl) return;
      release(parseInt(keyEl.dataset.midi, 10));
    });
    keysContainer.addEventListener("pointercancel", (e) => {
      const keyEl = e.target.closest(".keyboard__key");
      if (!keyEl) return;
      release(parseInt(keyEl.dataset.midi, 10));
    });
  }

  function bindComputerKeys() {
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
      const midi = cMidi(baseOctave) + KEY_MAP[key];
      press(midi);
    });

    window.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      if (KEY_MAP[key] === undefined) return;
      const midi = cMidi(baseOctave) + KEY_MAP[key];
      release(midi);
    });

    window.addEventListener("blur", () => panic());
  }

  function bindSizeSelector() {
    const group = document.getElementById("kb-size");
    if (!group) return;
    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".kb-size__btn");
      if (!btn || btn.disabled) return;
      setOctaveCount(btn.dataset.octaves);
    });
  }

  function init() {
    keysContainer = document.getElementById("keyboard-keys");
    scrollEl = document.querySelector(".keyboard__scroll");
    sizeMsgEl = document.getElementById("kb-size-msg");

    if (!keysContainer) {
      console.error("[KeyboardUI] #keyboard-keys missing");
      return;
    }

    rebuild();
    bindPointer();
    bindComputerKeys();
    bindSizeSelector();
    updateSizeButtonStates();

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        updateSizeButtonStates();
        rebuild();
      }, 120);
    });

    console.log("[KeyboardUI] initialized");
  }

  return {
    init,
    panic,
    changeOctave,
    setOctaveCount,
    getActiveNote: () => activeNoteName
  };
})();
