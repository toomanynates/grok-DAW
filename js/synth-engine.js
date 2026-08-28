/**
 * synth-engine.js
 * Web Audio synthesizer engine for Mini-DAW Chunk 1.
 *
 * Signal flow (per voice):
 *   Oscillator → BiquadFilter (low-pass) → Gain (envelope) → Master Gain → Analyser → Destination
 *
 * LFO (sine) modulates filter cutoff frequency.
 *
 * Console logs are used to validate assumptions during development.
 */

const SynthEngine = (function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Private state
  // ---------------------------------------------------------------------------
  let audioCtx = null;
  let masterGain = null;
  let analyser = null;
  let lfo = null;
  let lfoGain = null;          // depth control for LFO → cutoff
  let isUnlocked = false;

  // Current global parameters
  const params = {
    waveform: "sine",
    filterCutoff: 0.7,         // 0–1 → mapped to Hz
    filterQ: 0.1,              // 0–1 → mapped to Q
    lfoRate: 0.2,              // 0–1 → mapped to Hz
    lfoDepth: 0,               // 0–1
    attack: 0.05,              // 0–1 → seconds
    decay: 0.2,
    sustain: 0.7,              // 0–1 level
    release: 0.3,
    volume: 0.7,               // 0–1
    baseOctave: 3              // MIDI octave of the lowest C shown
  };

  // Active voices: midiNote → { osc, filter, gain, startedAt }
  const activeVoices = new Map();

  // Polyphony limit (keeps CPU reasonable)
  const MAX_VOICES = 8;

  // ---------------------------------------------------------------------------
  // Mapping helpers (0–1 UI values → real audio units)
  // ---------------------------------------------------------------------------
  function mapCutoff(norm) {
    // 40 Hz – 12 kHz, exponential feel
    const min = 40;
    const max = 12000;
    return min * Math.pow(max / min, norm);
  }

  function mapQ(norm) {
    // 0.0001 – 20
    return 0.0001 + norm * 19.9999;
  }

  function mapLfoRate(norm) {
    // 0.1 Hz – 15 Hz
    return 0.1 + norm * 14.9;
  }

  function mapTime(norm) {
    // 0.005 s – 2.5 s
    return 0.005 + norm * 2.495;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ---------------------------------------------------------------------------
  // Audio graph creation (called once after user gesture)
  // ---------------------------------------------------------------------------
  function createGraph() {
    if (audioCtx) {
      console.warn("[SynthEngine] AudioContext already exists");
      return;
    }

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    console.log("[SynthEngine] AudioContext created, state:", audioCtx.state);

    // Master gain
    masterGain = audioCtx.createGain();
    masterGain.gain.value = params.volume;

    // Analyser for level meter
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    // LFO (always running sine)
    lfo = audioCtx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = mapLfoRate(params.lfoRate);

    lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0; // depth starts at 0 (no modulation)

    lfo.connect(lfoGain);
    lfo.start();
    console.log("[SynthEngine] LFO started");

    // Master chain
    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);

    isUnlocked = true;
    console.log("[SynthEngine] Graph ready. isUnlocked = true");
  }

  async function unlock() {
    if (!audioCtx) {
      createGraph();
    }
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
      console.log("[SynthEngine] AudioContext resumed, state:", audioCtx.state);
    }
    return audioCtx.state === "running";
  }

  // ---------------------------------------------------------------------------
  // Voice management
  // ---------------------------------------------------------------------------
  function noteOn(midiNote, velocity = 0.85) {
    if (!isUnlocked || !audioCtx) {
      console.warn("[SynthEngine] noteOn ignored – audio not unlocked");
      return;
    }

    // Retrigger if already playing
    if (activeVoices.has(midiNote)) {
      noteOff(midiNote, true);
    }

    // Voice stealing if at limit
    if (activeVoices.size >= MAX_VOICES) {
      const oldest = activeVoices.keys().next().value;
      console.log("[SynthEngine] Voice steal – releasing MIDI", oldest);
      noteOff(oldest, true);
    }

    const now = audioCtx.currentTime;
    const freq = midiToFreq(midiNote);

    // Oscillator
    const osc = audioCtx.createOscillator();
    osc.type = params.waveform;
    osc.frequency.setValueAtTime(freq, now);

    // Filter
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(mapCutoff(params.filterCutoff), now);
    filter.Q.setValueAtTime(mapQ(params.filterQ), now);

    // Connect LFO → filter cutoff (modulation depth controlled by lfoGain)
    // We use a separate constant + LFO contribution for cleaner control
    lfoGain.connect(filter.frequency);

    // Envelope gain
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, now);

    const attack = mapTime(params.attack);
    const decay = mapTime(params.decay);
    const sustainLevel = params.sustain * velocity;

    gainNode.gain.linearRampToValueAtTime(velocity, now + attack);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attack + decay);

    // Wire: osc → filter → gain → master
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(masterGain);

    osc.start(now);

    activeVoices.set(midiNote, {
      osc,
      filter,
      gain: gainNode,
      startedAt: now
    });

    console.log(
      `[SynthEngine] noteOn MIDI ${midiNote} (${freq.toFixed(1)} Hz) ` +
      `wave=${params.waveform} voices=${activeVoices.size}`
    );
  }

  function noteOff(midiNote, immediate = false) {
    const voice = activeVoices.get(midiNote);
    if (!voice) return;

    const now = audioCtx.currentTime;
    const release = immediate ? 0.01 : mapTime(params.release);

    // Cancel any scheduled values and ramp to zero
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + release);

    // Stop oscillator after release
    voice.osc.stop(now + release + 0.02);

    // Clean up after release finishes
    setTimeout(() => {
      try {
        voice.osc.disconnect();
        voice.filter.disconnect();
        voice.gain.disconnect();
      } catch (e) {
        // already disconnected
      }
      activeVoices.delete(midiNote);
    }, (release + 0.05) * 1000);

    console.log(`[SynthEngine] noteOff MIDI ${midiNote} release=${release.toFixed(3)}s`);
  }

  function allNotesOff() {
    console.log("[SynthEngine] allNotesOff – releasing", activeVoices.size, "voices");
    for (const midi of [...activeVoices.keys()]) {
      noteOff(midi, true);
    }
  }

  // ---------------------------------------------------------------------------
  // Parameter setters
  // ---------------------------------------------------------------------------
  function setWaveform(type) {
    if (!["sine", "square", "sawtooth", "triangle"].includes(type)) {
      console.warn("[SynthEngine] Invalid waveform:", type);
      return;
    }
    params.waveform = type;
    // Live voices keep their original type (common synth behavior)
    console.log("[SynthEngine] waveform →", type);
  }

  function setFilterCutoff(norm) {
    params.filterCutoff = clamp01(norm);
    const hz = mapCutoff(params.filterCutoff);
    activeVoices.forEach((v) => {
      v.filter.frequency.setTargetAtTime(hz, audioCtx.currentTime, 0.03);
    });
    // Also update the base value so new voices and LFO modulation stay consistent
    console.log("[SynthEngine] filterCutoff →", (params.filterCutoff * 100).toFixed(0) + "%", `(${hz.toFixed(0)} Hz)`);
  }

  function setFilterQ(norm) {
    params.filterQ = clamp01(norm);
    const q = mapQ(params.filterQ);
    activeVoices.forEach((v) => {
      v.filter.Q.setTargetAtTime(q, audioCtx.currentTime, 0.03);
    });
    console.log("[SynthEngine] filterQ →", (params.filterQ * 100).toFixed(0) + "%", `(Q=${q.toFixed(2)})`);
  }

  function setLfoRate(norm) {
    params.lfoRate = clamp01(norm);
    if (lfo) {
      lfo.frequency.setTargetAtTime(mapLfoRate(params.lfoRate), audioCtx.currentTime, 0.05);
    }
    console.log("[SynthEngine] lfoRate →", (params.lfoRate * 100).toFixed(0) + "%", `(${mapLfoRate(params.lfoRate).toFixed(2)} Hz)`);
  }

  function setLfoDepth(norm) {
    params.lfoDepth = clamp01(norm);
    if (lfoGain) {
      // Depth scales how many Hz the LFO can push the cutoff
      // Max depth ≈ 4000 Hz swing when fully open
      const maxSwing = 4000 * params.lfoDepth;
      lfoGain.gain.setTargetAtTime(maxSwing, audioCtx.currentTime, 0.05);
    }
    console.log("[SynthEngine] lfoDepth →", (params.lfoDepth * 100).toFixed(0) + "%");
  }

  function setAttack(norm) {
    params.attack = clamp01(norm);
    console.log("[SynthEngine] attack →", mapTime(params.attack).toFixed(3) + "s");
  }

  function setDecay(norm) {
    params.decay = clamp01(norm);
    console.log("[SynthEngine] decay →", mapTime(params.decay).toFixed(3) + "s");
  }

  function setSustain(norm) {
    params.sustain = clamp01(norm);
    console.log("[SynthEngine] sustain →", (params.sustain * 100).toFixed(0) + "%");
  }

  function setRelease(norm) {
    params.release = clamp01(norm);
    console.log("[SynthEngine] release →", mapTime(params.release).toFixed(3) + "s");
  }

  function setVolume(norm) {
    params.volume = clamp01(norm);
    if (masterGain) {
      masterGain.gain.setTargetAtTime(params.volume, audioCtx.currentTime, 0.03);
    }
    console.log("[SynthEngine] volume →", (params.volume * 100).toFixed(0) + "%");
  }

  function setBaseOctave(oct) {
    params.baseOctave = Math.max(0, Math.min(7, oct));
    console.log("[SynthEngine] baseOctave →", params.baseOctave);
  }

  function getBaseOctave() {
    return params.baseOctave;
  }

  // ---------------------------------------------------------------------------
  // Level meter helper
  // ---------------------------------------------------------------------------
  function getLevel() {
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);

    // Peak deviation from 128 (silence)
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const dev = Math.abs(data[i] - 128);
      if (dev > peak) peak = dev;
    }
    return peak / 128; // 0–1
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function getParams() {
    return { ...params };
  }

  function isReady() {
    return isUnlocked && audioCtx && audioCtx.state === "running";
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  return {
    unlock,
    noteOn,
    noteOff,
    allNotesOff,
    setWaveform,
    setFilterCutoff,
    setFilterQ,
    setLfoRate,
    setLfoDepth,
    setAttack,
    setDecay,
    setSustain,
    setRelease,
    setVolume,
    setBaseOctave,
    getBaseOctave,
    getLevel,
    getParams,
    isReady
  };
})();
