/**
 * mono-synth.js
 * Tone.MonoSynth wrapper – single source of truth for the Play-mode instrument.
 *
 * All UI modules talk to this API (or through Bind → callbacks that call this).
 * Future synths (FM / AM) can follow the same shape.
 */

const MonoSynthEngine = (function () {
  "use strict";

  let synth = null;
  let meter = null;
  let unlocked = false;

  // Defaults aligned with a classic mono lead
  const defaults = {
    oscillator: { type: "sawtooth" },
    filter: {
      type: "lowpass",
      frequency: 2000,
      Q: 1,
      rolloff: -12
    },
    envelope: {
      attack: 0.02,
      decay: 0.2,
      sustain: 0.7,
      release: 0.4
    },
    filterEnvelope: {
      attack: 0.02,
      decay: 0.3,
      sustain: 0.4,
      release: 0.5,
      baseFrequency: 200,
      octaves: 3
    },
    volume: -6,       // dB
    portamento: 0     // seconds
  };

  /**
   * Create the MonoSynth + meter. Call only after Tone.start().
   */
  function create() {
    if (synth) {
      console.warn("[MonoSynth] already created");
      return;
    }

    synth = new Tone.MonoSynth({
      oscillator: { ...defaults.oscillator },
      filter: { ...defaults.filter },
      envelope: { ...defaults.envelope },
      filterEnvelope: { ...defaults.filterEnvelope }
    });

    synth.volume.value = defaults.volume;
    synth.portamento = defaults.portamento;

    // Level meter (Tone.Meter outputs dB; we normalize for UI)
    meter = new Tone.Meter({ channels: 1, normalRange: false });
    synth.connect(meter);
    synth.toDestination();

    unlocked = true;
    console.log("[MonoSynth] created", synth);
  }

  async function unlock() {
    await Tone.start();
    console.log("[MonoSynth] Tone context state:", Tone.getContext().state);
    if (!synth) create();
    return Tone.getContext().state === "running";
  }

  // ----- Notes -----
  function noteOn(midi, velocity = 0.85) {
    if (!synth) return;
    const note = Tone.Frequency(midi, "midi").toNote();
    synth.triggerAttack(note, Tone.now(), velocity);
    console.log("[MonoSynth] noteOn", note, "midi", midi);
    return note;
  }

  function noteOff() {
    if (!synth) return;
    synth.triggerRelease(Tone.now());
    console.log("[MonoSynth] noteOff");
  }

  /** Panic – release immediately */
  function allNotesOff() {
    if (!synth) return;
    // MonoSynth only holds one voice; release + silence
    synth.triggerRelease(Tone.now());
    // Hard cut residual gain if any
    const now = Tone.now();
    synth.volume.cancelScheduledValues(now);
    synth.volume.setValueAtTime(synth.volume.value, now);
    console.log("[MonoSynth] allNotesOff");
  }

  // ----- Parameter setters (used by controls / Bind callbacks) -----
  function setOscType(type) {
    if (!synth) return;
    synth.oscillator.type = type;
    console.log("[MonoSynth] oscillator.type →", type);
  }

  function setFilterFreq(hz) {
    if (!synth) return;
    synth.filter.frequency.value = hz;
  }

  function setFilterQ(q) {
    if (!synth) return;
    synth.filter.Q.value = q;
  }

  function setAmpAttack(s) {
    if (!synth) return;
    synth.envelope.attack = s;
  }
  function setAmpDecay(s) {
    if (!synth) return;
    synth.envelope.decay = s;
  }
  function setAmpSustain(n) {
    if (!synth) return;
    synth.envelope.sustain = n;
  }
  function setAmpRelease(s) {
    if (!synth) return;
    synth.envelope.release = s;
  }

  function setFilterEnvAttack(s) {
    if (!synth) return;
    synth.filterEnvelope.attack = s;
  }
  function setFilterEnvDecay(s) {
    if (!synth) return;
    synth.filterEnvelope.decay = s;
  }
  function setFilterEnvSustain(n) {
    if (!synth) return;
    synth.filterEnvelope.sustain = n;
  }
  function setFilterEnvRelease(s) {
    if (!synth) return;
    synth.filterEnvelope.release = s;
  }
  function setFilterEnvBase(hz) {
    if (!synth) return;
    synth.filterEnvelope.baseFrequency = hz;
  }
  function setFilterEnvOctaves(n) {
    if (!synth) return;
    synth.filterEnvelope.octaves = n;
  }

  function setVolume(db) {
    if (!synth) return;
    synth.volume.value = db;
  }

  function setPortamento(s) {
    if (!synth) return;
    synth.portamento = s;
  }

  /**
   * Restore factory defaults and return the defaults object
   * so the UI can refresh knobs.
   */
  function resetToDefaults() {
    if (!synth) return defaults;

    synth.oscillator.type = defaults.oscillator.type;
    synth.filter.frequency.value = defaults.filter.frequency;
    synth.filter.Q.value = defaults.filter.Q;
    synth.envelope.attack = defaults.envelope.attack;
    synth.envelope.decay = defaults.envelope.decay;
    synth.envelope.sustain = defaults.envelope.sustain;
    synth.envelope.release = defaults.envelope.release;
    synth.filterEnvelope.attack = defaults.filterEnvelope.attack;
    synth.filterEnvelope.decay = defaults.filterEnvelope.decay;
    synth.filterEnvelope.sustain = defaults.filterEnvelope.sustain;
    synth.filterEnvelope.release = defaults.filterEnvelope.release;
    synth.filterEnvelope.baseFrequency = defaults.filterEnvelope.baseFrequency;
    synth.filterEnvelope.octaves = defaults.filterEnvelope.octaves;
    synth.volume.value = defaults.volume;
    synth.portamento = defaults.portamento;

    allNotesOff();
    console.log("[MonoSynth] resetToDefaults");
    return { ...defaults };
  }

  /**
   * Peak level 0–1 for the meter UI (Tone.Meter is in dB).
   */
  function getLevel() {
    if (!meter) return 0;
    const db = meter.getValue();
    // Map roughly -60..0 dB → 0..1
    const level = Tone.dbToGain(Math.min(0, typeof db === "number" ? db : -Infinity));
    return Math.min(1, level * 1.5);
  }

  function isReady() {
    return unlocked && synth && Tone.getContext().state === "running";
  }

  function getDefaults() {
    return JSON.parse(JSON.stringify(defaults));
  }

  return {
    unlock,
    noteOn,
    noteOff,
    allNotesOff,
    setOscType,
    setFilterFreq,
    setFilterQ,
    setAmpAttack,
    setAmpDecay,
    setAmpSustain,
    setAmpRelease,
    setFilterEnvAttack,
    setFilterEnvDecay,
    setFilterEnvSustain,
    setFilterEnvRelease,
    setFilterEnvBase,
    setFilterEnvOctaves,
    setVolume,
    setPortamento,
    resetToDefaults,
    getLevel,
    isReady,
    getDefaults
  };
})();
