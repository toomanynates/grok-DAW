/**
 * ui-controls.js
 * Knobs, waveform selector, octave buttons, level meter animation.
 *
 * Knobs use pointer events (drag vertically) and also respond to
 * keyboard arrow keys when focused.
 */

const UIControls = (function () {
  "use strict";

  // Default normalized values (must match HTML aria-valuenow / data)
  const defaults = {
    filterCutoff: 0.7,
    filterQ: 0.1,
    lfoRate: 0.2,
    lfoDepth: 0,
    attack: 0.05,
    decay: 0.2,
    sustain: 0.7,
    release: 0.3,
    volume: 0.7
  };

  // Current values (0–1)
  const values = { ...defaults };

  // Map param name → SynthEngine setter
  const setters = {
    filterCutoff: (v) => SynthEngine.setFilterCutoff(v),
    filterQ:      (v) => SynthEngine.setFilterQ(v),
    lfoRate:      (v) => SynthEngine.setLfoRate(v),
    lfoDepth:     (v) => SynthEngine.setLfoDepth(v),
    attack:       (v) => SynthEngine.setAttack(v),
    decay:        (v) => SynthEngine.setDecay(v),
    sustain:      (v) => SynthEngine.setSustain(v),
    release:      (v) => SynthEngine.setRelease(v),
    volume:       (v) => SynthEngine.setVolume(v)
  };

  // Knob rotation range (degrees). Indicator starts at -135° and goes to +135°.
  const ROT_MIN = -135;
  const ROT_MAX = 135;
  const ROT_RANGE = ROT_MAX - ROT_MIN;

  /**
   * Update visual state of a single knob.
   */
  function updateKnobVisual(knobEl, norm) {
    const indicator = knobEl.querySelector(".knob__indicator");
    const valueEl = knobEl.querySelector(".knob__value");
    const control = knobEl.querySelector(".knob__control");

    if (indicator) {
      const deg = ROT_MIN + norm * ROT_RANGE;
      indicator.style.transform = `translateX(-50%) rotate(${deg}deg)`;
    }
    if (valueEl) {
      valueEl.textContent = Math.round(norm * 100) + "%";
    }
    if (control) {
      control.setAttribute("aria-valuenow", Math.round(norm * 100));
    }
  }

  /**
   * Apply a parameter change (visual + engine).
   */
  function setParam(name, norm) {
    norm = Math.max(0, Math.min(1, norm));
    values[name] = norm;

    const knobEl = document.querySelector(`.knob[data-param="${name}"]`);
    if (knobEl) {
      updateKnobVisual(knobEl, norm);
    }

    if (setters[name]) {
      setters[name](norm);
    }
  }

  /**
   * Make a knob interactive.
   */
  function bindKnob(knobEl) {
    const param = knobEl.dataset.param;
    if (!param || !setters[param]) {
      console.warn("[UIControls] Unknown knob param:", param);
      return;
    }

    const control = knobEl.querySelector(".knob__control");
    if (!control) return;

    let dragging = false;
    let startY = 0;
    let startVal = 0;

    const onPointerDown = (e) => {
      dragging = true;
      startY = e.clientY;
      startVal = values[param];
      control.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    const onPointerMove = (e) => {
      if (!dragging) return;
      // Drag up = increase value
      const deltaY = startY - e.clientY;
      const sensitivity = 0.005; // 200 px ≈ full range
      const newVal = startVal + deltaY * sensitivity;
      setParam(param, newVal);
    };

    const onPointerUp = () => {
      dragging = false;
    };

    control.addEventListener("pointerdown", onPointerDown);
    control.addEventListener("pointermove", onPointerMove);
    control.addEventListener("pointerup", onPointerUp);
    control.addEventListener("pointercancel", onPointerUp);

    // Keyboard support when focused
    control.addEventListener("keydown", (e) => {
      let delta = 0;
      if (e.key === "ArrowUp" || e.key === "ArrowRight") delta = 0.02;
      if (e.key === "ArrowDown" || e.key === "ArrowLeft") delta = -0.02;
      if (e.key === "PageUp") delta = 0.1;
      if (e.key === "PageDown") delta = -0.1;
      if (e.key === "Home") {
        setParam(param, 0);
        return;
      }
      if (e.key === "End") {
        setParam(param, 1);
        return;
      }
      if (delta !== 0) {
        e.preventDefault();
        setParam(param, values[param] + delta);
      }
    });

    // Initialize visual from default
    updateKnobVisual(knobEl, values[param]);
  }

  /**
   * Waveform selector buttons.
   */
  function bindWaveformSelector() {
    const container = document.getElementById("waveform-selector");
    if (!container) return;

    container.addEventListener("click", (e) => {
      const btn = e.target.closest(".waveform__btn");
      if (!btn) return;

      const wave = btn.dataset.wave;
      if (!wave) return;

      // Update active class
      container.querySelectorAll(".waveform__btn").forEach((b) => {
        b.classList.toggle("waveform__btn--active", b === btn);
      });

      SynthEngine.setWaveform(wave);
      console.log("[UIControls] Waveform selected:", wave);
    });
  }

  /**
   * Octave + / – buttons.
   */
  function bindOctaveButtons() {
    const down = document.getElementById("octave-down");
    const up = document.getElementById("octave-up");

    if (down) {
      down.addEventListener("click", () => {
        KeyboardUI.changeOctave(-1);
      });
    }
    if (up) {
      up.addEventListener("click", () => {
        KeyboardUI.changeOctave(1);
      });
    }
  }

  /**
   * Level meter animation loop.
   */
  let meterRaf = null;

  function startMeter() {
    const fill = document.getElementById("level-meter-fill");
    if (!fill) return;

    function tick() {
      if (SynthEngine.isReady()) {
        const level = SynthEngine.getLevel();
        // Slight easing so it doesn't jitter too hard
        const pct = Math.min(100, level * 120); // mild headroom boost
        fill.style.width = pct.toFixed(1) + "%";
      }
      meterRaf = requestAnimationFrame(tick);
    }
    tick();
    console.log("[UIControls] Level meter started");
  }

  function stopMeter() {
    if (meterRaf) {
      cancelAnimationFrame(meterRaf);
      meterRaf = null;
    }
  }

  /**
   * Restore every parameter to its default value and update the UI.
   * Does NOT touch the current octave (caller can reset that separately).
   */
  function resetToDefaults() {
    console.log("[UIControls] resetToDefaults");

    Object.keys(defaults).forEach((name) => {
      setParam(name, defaults[name]);
    });

    // Waveform back to sine
    const waveContainer = document.getElementById("waveform-selector");
    if (waveContainer) {
      waveContainer.querySelectorAll(".waveform__btn").forEach((btn) => {
        const isSine = btn.dataset.wave === "sine";
        btn.classList.toggle("waveform__btn--active", isSine);
      });
      SynthEngine.setWaveform("sine");
    }
  }

  function bindResetButton() {
    const btn = document.getElementById("reset-btn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      console.log("[UIControls] Reset button clicked");

      // 1. Kill all sounding notes + clear key highlights
      KeyboardUI.panic();

      // 2. Restore knob / waveform defaults
      resetToDefaults();

      // 3. Return to starting octave (3)
      const current = SynthEngine.getBaseOctave();
      if (current !== 3) {
        KeyboardUI.changeOctave(3 - current); // panic is already inside changeOctave
      } else {
        KeyboardUI.updateOctaveDisplay();
      }

      console.log("[UIControls] Reset complete");
    });
  }

  /**
   * Public init – call after DOM is ready and SynthEngine exists.
   */
  function init() {
    // Bind all knobs
    document.querySelectorAll(".knob[data-param]").forEach(bindKnob);

    // Push initial values into the engine (in case defaults differ)
    Object.keys(setters).forEach((name) => {
      setters[name](values[name]);
    });

    bindWaveformSelector();
    bindOctaveButtons();
    bindResetButton();

    console.log("[UIControls] Initialized with defaults:", values);
  }

  return {
    init,
    setParam,
    startMeter,
    stopMeter,
    resetToDefaults,
    getValues: () => ({ ...values })
  };
})();
