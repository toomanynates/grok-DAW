/**
 * bind.js
 * Reusable UI → Tone.js parameter binding layer.
 *
 * Every synth panel should use these helpers so controls stay consistent
 * across MonoSynth, FMSynth, AMSynth, etc.
 *
 * Usage:
 *   Bind.createKnob(container, { label, min, max, value, curve, format, onInput })
 *   Bind.bindSelectGroup(element, values, onChange)
 */

const Bind = (function () {
  "use strict";

  const ROT_MIN = -135;
  const ROT_MAX = 135;
  const ROT_RANGE = ROT_MAX - ROT_MIN;

  /**
   * Map normalized 0–1 → value with optional exponential curve.
   */
  function fromNorm(norm, min, max, curve) {
    norm = clamp01(norm);
    if (curve === "exponential") {
      const safeMin = Math.max(min, 1e-6);
      return safeMin * Math.pow(max / safeMin, norm);
    }
    return min + norm * (max - min);
  }

  /**
   * Map value → normalized 0–1.
   */
  function toNorm(value, min, max, curve) {
    if (curve === "exponential") {
      const safeMin = Math.max(min, 1e-6);
      const safeVal = Math.max(value, safeMin);
      return Math.log(safeVal / safeMin) / Math.log(max / safeMin);
    }
    if (max === min) return 0;
    return (value - min) / (max - min);
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function defaultFormat(value, unit) {
    if (unit === "Hz") {
      if (value >= 1000) return (value / 1000).toFixed(1) + "k";
      return Math.round(value) + " Hz";
    }
    if (unit === "s") {
      if (value < 0.01) return (value * 1000).toFixed(0) + "ms";
      return value.toFixed(2) + "s";
    }
    if (unit === "%") return Math.round(value * 100) + "%";
    if (unit === "st") return value.toFixed(1) + " st"; // semitones (portamento)
    return value.toFixed(2);
  }

  /**
   * Create an SVG knob and return a controller object.
   *
   * @param {HTMLElement} parent
   * @param {object} opts
   * @param {string} opts.label
   * @param {number} opts.min
   * @param {number} opts.max
   * @param {number} opts.value   initial
   * @param {string} [opts.curve="linear"]
   * @param {string} [opts.unit]
   * @param {function} [opts.format]
   * @param {function} opts.onInput  (value) => void  – called on every change
   */
  function createKnob(parent, opts) {
    const {
      label = "",
      min = 0,
      max = 1,
      value: initial = min,
      curve = "linear",
      unit = "",
      format = null,
      onInput = () => {}
    } = opts;

    const wrap = document.createElement("div");
    wrap.className = "knob";

    const labelEl = document.createElement("span");
    labelEl.className = "knob__label";
    labelEl.textContent = label;
    wrap.appendChild(labelEl);

    // SVG knob face
    const size = 56;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "knob__svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("tabindex", "0");
    svg.setAttribute("role", "slider");
    svg.setAttribute("aria-valuemin", String(min));
    svg.setAttribute("aria-valuemax", String(max));

    // Track arc background
    const track = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    track.setAttribute("cx", size / 2);
    track.setAttribute("cy", size / 2);
    track.setAttribute("r", 22);
    track.setAttribute("fill", "none");
    track.setAttribute("stroke", "#2a2e3d");
    track.setAttribute("stroke-width", "4");
    svg.appendChild(track);

    // Value arc
    const arc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    arc.setAttribute("cx", size / 2);
    arc.setAttribute("cy", size / 2);
    arc.setAttribute("r", 22);
    arc.setAttribute("fill", "none");
    arc.setAttribute("stroke", "#5b8def");
    arc.setAttribute("stroke-width", "4");
    arc.setAttribute("stroke-linecap", "round");
    arc.style.transformOrigin = "center";
    arc.style.transform = "rotate(-135deg)";
    svg.appendChild(arc);

    // Center disc
    const disc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    disc.setAttribute("cx", size / 2);
    disc.setAttribute("cy", size / 2);
    disc.setAttribute("r", 16);
    disc.setAttribute("fill", "#1a1d28");
    disc.setAttribute("stroke", "#2a2e3d");
    disc.setAttribute("stroke-width", "1");
    svg.appendChild(disc);

    // Indicator line
    const indicator = document.createElementNS("http://www.w3.org/2000/svg", "line");
    indicator.setAttribute("x1", size / 2);
    indicator.setAttribute("y1", size / 2);
    indicator.setAttribute("x2", size / 2);
    indicator.setAttribute("y2", 10);
    indicator.setAttribute("stroke", "#5b8def");
    indicator.setAttribute("stroke-width", "2.5");
    indicator.setAttribute("stroke-linecap", "round");
    indicator.style.transformOrigin = "center";
    svg.appendChild(indicator);

    wrap.appendChild(svg);

    const valueEl = document.createElement("span");
    valueEl.className = "knob__value";
    wrap.appendChild(valueEl);

    parent.appendChild(wrap);

    let current = initial;

    function render() {
      const norm = toNorm(current, min, max, curve);
      const deg = ROT_MIN + clamp01(norm) * ROT_RANGE;
      indicator.style.transform = `rotate(${deg}deg)`;

      // Arc length: full usable range is 270deg of 360
      const circumference = 2 * Math.PI * 22;
      const arcLen = (270 / 360) * circumference;
      arc.style.strokeDasharray = `${arcLen} ${circumference}`;
      arc.style.strokeDashoffset = String(arcLen * (1 - clamp01(norm)));

      const fmt = format || ((v) => defaultFormat(v, unit));
      valueEl.textContent = fmt(current);
      svg.setAttribute("aria-valuenow", String(current));
    }

    function setValue(v, emit) {
      current = Math.max(min, Math.min(max, v));
      render();
      if (emit !== false) onInput(current);
    }

    // Pointer drag
    let dragging = false;
    let startY = 0;
    let startVal = 0;

    svg.addEventListener("pointerdown", (e) => {
      dragging = true;
      startY = e.clientY;
      startVal = current;
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    svg.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const deltaY = startY - e.clientY;
      const sensitivity = (max - min) / 200; // 200px ≈ full range
      let next;
      if (curve === "exponential") {
        const startNorm = toNorm(startVal, min, max, curve);
        const nextNorm = clamp01(startNorm + deltaY / 200);
        next = fromNorm(nextNorm, min, max, curve);
      } else {
        next = startVal + deltaY * sensitivity;
      }
      setValue(next, true);
    });

    svg.addEventListener("pointerup", () => { dragging = false; });
    svg.addEventListener("pointercancel", () => { dragging = false; });

    // Keyboard
    svg.addEventListener("keydown", (e) => {
      const step = (max - min) * 0.02;
      const big = (max - min) * 0.1;
      let next = current;
      if (e.key === "ArrowUp" || e.key === "ArrowRight") next = current + step;
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") next = current - step;
      else if (e.key === "PageUp") next = current + big;
      else if (e.key === "PageDown") next = current - big;
      else if (e.key === "Home") next = min;
      else if (e.key === "End") next = max;
      else return;
      e.preventDefault();
      setValue(next, true);
    });

    render();

    return {
      setValue: (v) => setValue(v, false),
      getValue: () => current,
      element: wrap
    };
  }

  /**
   * Wire a button group (.select-group) to a callback.
   * Buttons need data-value attributes.
   */
  function bindSelectGroup(container, onChange) {
    if (!container) return;

    container.addEventListener("click", (e) => {
      const btn = e.target.closest(".select-group__btn");
      if (!btn || btn.disabled) return;
      const value = btn.dataset.value;
      container.querySelectorAll(".select-group__btn").forEach((b) => {
        b.classList.toggle("select-group__btn--active", b === btn);
      });
      onChange(value);
    });
  }

  /**
   * Set active button in a select group by value (no callback).
   */
  function setSelectGroupValue(container, value) {
    if (!container) return;
    container.querySelectorAll(".select-group__btn").forEach((b) => {
      b.classList.toggle("select-group__btn--active", b.dataset.value === value);
    });
  }

  return {
    createKnob,
    bindSelectGroup,
    setSelectGroupValue,
    fromNorm,
    toNorm,
    defaultFormat
  };
})();
