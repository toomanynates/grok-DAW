/**
 * controls.js
 * Builds MonoSynth control panels using the shared Bind layer.
 *
 * Panels: Oscillator · Filter · Amp Envelope · Filter Envelope · Global
 */

const ControlsUI = (function () {
  "use strict";

  // Keep references so Reset can restore knob positions
  const knobs = {};

  function buildFilterKnobs() {
    const row = document.getElementById("filter-knobs");
    if (!row) return;
    row.innerHTML = "";

    knobs.filterFreq = Bind.createKnob(row, {
      label: "Cutoff",
      min: 40,
      max: 12000,
      value: 2000,
      curve: "exponential",
      unit: "Hz",
      onInput: (v) => MonoSynthEngine.setFilterFreq(v)
    });

    knobs.filterQ = Bind.createKnob(row, {
      label: "Reso",
      min: 0.1,
      max: 18,
      value: 1,
      curve: "linear",
      unit: "",
      format: (v) => v.toFixed(1),
      onInput: (v) => MonoSynthEngine.setFilterQ(v)
    });
  }

  function buildAmpEnvKnobs() {
    const row = document.getElementById("amp-env-knobs");
    if (!row) return;
    row.innerHTML = "";

    const defs = [
      { key: "ampAttack", label: "A", min: 0.005, max: 2, value: 0.02, setter: "setAmpAttack" },
      { key: "ampDecay", label: "D", min: 0.01, max: 2, value: 0.2, setter: "setAmpDecay" },
      { key: "ampSustain", label: "S", min: 0, max: 1, value: 0.7, setter: "setAmpSustain", unit: "%" },
      { key: "ampRelease", label: "R", min: 0.01, max: 3, value: 0.4, setter: "setAmpRelease" }
    ];

    defs.forEach((d) => {
      knobs[d.key] = Bind.createKnob(row, {
        label: d.label,
        min: d.min,
        max: d.max,
        value: d.value,
        curve: d.key === "ampSustain" ? "linear" : "exponential",
        unit: d.unit || "s",
        onInput: (v) => MonoSynthEngine[d.setter](v)
      });
    });
  }

  function buildFilterEnvKnobs() {
    const row = document.getElementById("filter-env-knobs");
    if (!row) return;
    row.innerHTML = "";

    const defs = [
      { key: "fEnvAttack", label: "A", min: 0.005, max: 2, value: 0.02, setter: "setFilterEnvAttack", unit: "s" },
      { key: "fEnvDecay", label: "D", min: 0.01, max: 2, value: 0.3, setter: "setFilterEnvDecay", unit: "s" },
      { key: "fEnvSustain", label: "S", min: 0, max: 1, value: 0.4, setter: "setFilterEnvSustain", unit: "%" },
      { key: "fEnvRelease", label: "R", min: 0.01, max: 3, value: 0.5, setter: "setFilterEnvRelease", unit: "s" },
      { key: "fEnvBase", label: "Base", min: 40, max: 5000, value: 200, setter: "setFilterEnvBase", unit: "Hz", curve: "exponential" },
      { key: "fEnvOct", label: "Oct", min: 0, max: 8, value: 3, setter: "setFilterEnvOctaves", unit: "", format: (v) => v.toFixed(1) }
    ];

    defs.forEach((d) => {
      knobs[d.key] = Bind.createKnob(row, {
        label: d.label,
        min: d.min,
        max: d.max,
        value: d.value,
        curve: d.curve || (d.unit === "s" ? "exponential" : "linear"),
        unit: d.unit || "",
        format: d.format,
        onInput: (v) => MonoSynthEngine[d.setter](v)
      });
    });
  }

  function buildGlobal() {
    const row = document.getElementById("global-controls");
    if (!row) return;
    row.innerHTML = "";

    // Volume (dB)
    knobs.volume = Bind.createKnob(row, {
      label: "Vol",
      min: -40,
      max: 0,
      value: -6,
      curve: "linear",
      unit: "",
      format: (v) => (v >= 0 ? "0 dB" : v.toFixed(0) + " dB"),
      onInput: (v) => MonoSynthEngine.setVolume(v)
    });

    // Portamento (seconds)
    knobs.portamento = Bind.createKnob(row, {
      label: "Porta",
      min: 0,
      max: 0.5,
      value: 0,
      curve: "linear",
      unit: "s",
      onInput: (v) => MonoSynthEngine.setPortamento(v)
    });

    // Active note display
    const noteWrap = document.createElement("div");
    noteWrap.className = "note-display";
    noteWrap.innerHTML = `
      <span class="note-display__label">Note</span>
      <span class="note-display__value" id="active-note-value">—</span>
    `;
    row.appendChild(noteWrap);

    // Level meter
    const meterWrap = document.createElement("div");
    meterWrap.className = "meter";
    meterWrap.innerHTML = `
      <span class="meter__label">Level</span>
      <div class="meter__track"><div class="meter__fill" id="level-meter-fill"></div></div>
    `;
    row.appendChild(meterWrap);

    // Reset
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "reset-btn";
    resetBtn.id = "reset-btn";
    resetBtn.title = "Reset defaults & kill notes (Esc)";
    resetBtn.innerHTML = `<i class="fa-solid fa-rotate-left"></i><span>Reset</span>`;
    resetBtn.addEventListener("click", onReset);
    row.appendChild(resetBtn);
  }

  function bindOscillator() {
    const group = document.getElementById("osc-type");
    Bind.bindSelectGroup(group, (type) => {
      MonoSynthEngine.setOscType(type);
    });
  }

  function onReset() {
    console.log("[ControlsUI] Reset");
    KeyboardUI.panic();
    const d = MonoSynthEngine.resetToDefaults();

    // Sync knobs to defaults
    if (knobs.filterFreq) knobs.filterFreq.setValue(d.filter.frequency);
    if (knobs.filterQ) knobs.filterQ.setValue(d.filter.Q);
    if (knobs.ampAttack) knobs.ampAttack.setValue(d.envelope.attack);
    if (knobs.ampDecay) knobs.ampDecay.setValue(d.envelope.decay);
    if (knobs.ampSustain) knobs.ampSustain.setValue(d.envelope.sustain);
    if (knobs.ampRelease) knobs.ampRelease.setValue(d.envelope.release);
    if (knobs.fEnvAttack) knobs.fEnvAttack.setValue(d.filterEnvelope.attack);
    if (knobs.fEnvDecay) knobs.fEnvDecay.setValue(d.filterEnvelope.decay);
    if (knobs.fEnvSustain) knobs.fEnvSustain.setValue(d.filterEnvelope.sustain);
    if (knobs.fEnvRelease) knobs.fEnvRelease.setValue(d.filterEnvelope.release);
    if (knobs.fEnvBase) knobs.fEnvBase.setValue(d.filterEnvelope.baseFrequency);
    if (knobs.fEnvOct) knobs.fEnvOct.setValue(d.filterEnvelope.octaves);
    if (knobs.volume) knobs.volume.setValue(d.volume);
    if (knobs.portamento) knobs.portamento.setValue(d.portamento);

    Bind.setSelectGroupValue(document.getElementById("osc-type"), d.oscillator.type);
  }

  // Meter animation
  let meterRaf = null;

  function startMeter() {
    const fill = document.getElementById("level-meter-fill");
    if (!fill) return;

    function tick() {
      if (MonoSynthEngine.isReady()) {
        const level = MonoSynthEngine.getLevel();
        fill.style.width = Math.min(100, level * 100).toFixed(1) + "%";
      }
      meterRaf = requestAnimationFrame(tick);
    }
    tick();
  }

  function init() {
    buildFilterKnobs();
    buildAmpEnvKnobs();
    buildFilterEnvKnobs();
    buildGlobal();
    bindOscillator();
    console.log("[ControlsUI] initialized");
  }

  return {
    init,
    startMeter,
    onReset
  };
})();
