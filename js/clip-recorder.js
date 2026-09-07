/**
 * clip-recorder.js
 * Chunk 2 – capture live keyboard notes into a single clip, then play them back.
 *
 * Note format (MIDI-like, ready for piano-roll / multitrack later):
 *   { pitch: number, start: number, duration: number, velocity: number }
 *
 * Timing uses Tone.now() relative to recordStartTime so playback stays
 * sample-accurate when scheduled through Tone.
 */

const ClipRecorder = (function () {
  "use strict";

  /** @type {'idle'|'recording'|'playing'} */
  let state = "idle";

  /** Absolute Tone time when Record was pressed */
  let recordStartTime = 0;

  /** Finalized notes in the current clip */
  let notes = [];

  /**
   * Notes that are currently held while recording:
   * midi → { pitch, start, velocity }
   */
  const openNotes = new Map();

  /** Active Tone.Part used for playback (disposed on stop/clear) */
  let playPart = null;

  /** UI update callback */
  let onChange = () => {};

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  function startRecording() {
    if (state === "playing") stopPlayback();

    // Close any dangling open notes (shouldn't happen, but be safe)
    openNotes.clear();
    notes = [];
    recordStartTime = Tone.now();
    state = "recording";

    console.log("[ClipRecorder] recording started at", recordStartTime.toFixed(3));
    notify();
  }

  function stopRecording() {
    if (state !== "recording") return;

    const now = relativeNow();

    // Finalize any keys still held
    openNotes.forEach((pending, midi) => {
      const duration = Math.max(0.01, now - pending.start);
      notes.push({
        pitch: pending.pitch,
        start: pending.start,
        duration,
        velocity: pending.velocity
      });
      console.log("[ClipRecorder] force-close MIDI", midi, "dur", duration.toFixed(3));
    });
    openNotes.clear();

    // Sort by start time
    notes.sort((a, b) => a.start - b.start);

    state = "idle";
    console.log("[ClipRecorder] recording stopped –", notes.length, "notes");
    notify();
  }

  /**
   * Called from KeyboardUI on note press while audio is live.
   */
  function noteOn(midi, velocity = 0.85) {
    if (state !== "recording") return;

    const t = relativeNow();

    // Monophonic: if another note is open, close it at this instant
    openNotes.forEach((pending, prevMidi) => {
      const duration = Math.max(0.01, t - pending.start);
      notes.push({
        pitch: pending.pitch,
        start: pending.start,
        duration,
        velocity: pending.velocity
      });
      openNotes.delete(prevMidi);
      console.log("[ClipRecorder] legato-close MIDI", prevMidi, "→", midi);
    });

    openNotes.set(midi, {
      pitch: midi,
      start: t,
      velocity
    });
  }

  /**
   * Called from KeyboardUI on note release.
   */
  function noteOff(midi) {
    if (state !== "recording") return;

    const pending = openNotes.get(midi);
    if (!pending) return;

    const t = relativeNow();
    const duration = Math.max(0.01, t - pending.start);

    notes.push({
      pitch: pending.pitch,
      start: pending.start,
      duration,
      velocity: pending.velocity
    });
    openNotes.delete(midi);

    console.log(
      "[ClipRecorder] noteOff MIDI",
      midi,
      "start",
      pending.start.toFixed(3),
      "dur",
      duration.toFixed(3)
    );
    notify();
  }

  function relativeNow() {
    return Math.max(0, Tone.now() - recordStartTime);
  }

  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------

  function playClip() {
    if (!notes.length) {
      console.warn("[ClipRecorder] nothing to play");
      return;
    }
    if (state === "recording") {
      console.warn("[ClipRecorder] stop recording before play");
      return;
    }
    if (state === "playing") stopPlayback();

    const transport = Tone.getTransport();
    transport.cancel(0);
    transport.position = 0;

    // Events: [timeSeconds, noteData]
    const events = notes.map((n) => [
      n.start,
      { pitch: n.pitch, duration: n.duration, velocity: n.velocity }
    ]);

    playPart = new Tone.Part((time, value) => {
      // Schedule attack/release on the shared MonoSynth at the Part's audio time
      MonoSynthEngine.triggerAttackRelease(
        value.pitch,
        value.duration,
        time,
        value.velocity
      );
    }, events);

    playPart.start(0);

    const clipEnd = clipDuration() + 0.2;
    transport.scheduleOnce(() => {
      stopPlayback();
    }, clipEnd);

    transport.start();

    state = "playing";
    console.log(
      "[ClipRecorder] playing",
      notes.length,
      "notes, duration",
      clipDuration().toFixed(2),
      "s"
    );
    notify();
  }

  function stopPlayback() {
    if (playPart) {
      try {
        playPart.stop();
        playPart.dispose();
      } catch (e) {
        // already disposed
      }
      playPart = null;
    }
    MonoSynthEngine.allNotesOff();

    const transport = Tone.getTransport();
    transport.cancel(0);
    if (transport.state === "started") {
      transport.stop();
    }
    transport.position = 0;

    if (state === "playing") {
      state = "idle";
      console.log("[ClipRecorder] playback stopped");
      notify();
    }
  }

  // ---------------------------------------------------------------------------
  // Clip data helpers
  // ---------------------------------------------------------------------------

  function clearClip() {
    stopPlayback();
    if (state === "recording") stopRecording();
    notes = [];
    openNotes.clear();
    state = "idle";
    console.log("[ClipRecorder] clip cleared");
    notify();
  }

  function getNotes() {
    return notes.map((n) => ({ ...n }));
  }

  function clipDuration() {
    if (!notes.length) return 0;
    return notes.reduce((max, n) => Math.max(max, n.start + n.duration), 0);
  }

  function getState() {
    return state;
  }

  function getSummary() {
    return {
      state,
      noteCount: notes.length + openNotes.size,
      duration: clipDuration(),
      hasClip: notes.length > 0
    };
  }

  function setOnChange(fn) {
    onChange = typeof fn === "function" ? fn : () => {};
  }

  function notify() {
    onChange(getSummary());
  }

  /**
   * If recording is active and user hits panic, close open notes cleanly.
   */
  function onPanic() {
    if (state === "recording" && openNotes.size > 0) {
      const t = relativeNow();
      openNotes.forEach((pending) => {
        notes.push({
          pitch: pending.pitch,
          start: pending.start,
          duration: Math.max(0.01, t - pending.start),
          velocity: pending.velocity
        });
      });
      openNotes.clear();
      notify();
    }
    if (state === "playing") {
      stopPlayback();
    }
  }

  return {
    startRecording,
    stopRecording,
    playClip,
    stopPlayback,
    clearClip,
    noteOn,
    noteOff,
    onPanic,
    getNotes,
    getState,
    getSummary,
    setOnChange,
    clipDuration
  };
})();
