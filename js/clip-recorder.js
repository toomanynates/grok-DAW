/**
 * clip-recorder.js
 * Chunk 2 / 2.5 – multi-take recording library.
 *
 * Note format (MIDI-like, ready for piano-roll):
 *   { pitch, start, duration, velocity }
 *
 * Take:
 *   { id, name, notes[] }
 *
 * Record always creates a NEW take. Delete removes a take and renumbers
 * display names (Take 1…N). Internal ids stay stable for future editing.
 */

const ClipRecorder = (function () {
  "use strict";

  /** @type {'idle'|'recording'|'playing'} */
  let state = "idle";

  /** Absolute Tone time when Record was pressed */
  let recordStartTime = 0;

  /** @type {{ id: string, name: string, notes: Array }} */
  let takes = [];

  /** id of selected take (null if library empty) */
  let selectedId = null;

  /** Notes being captured into the in-progress take */
  let recordingNotes = [];

  /** midi → { pitch, start, velocity } while keys held during record */
  const openNotes = new Map();

  /** Id of take currently being recorded (not in `takes` until stop) */
  let recordingTakeId = null;

  let playPart = null;
  let onChange = () => {};
  let takeCounter = 0; // for stable unique ids

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function makeId() {
    takeCounter += 1;
    return "take_" + takeCounter + "_" + Date.now().toString(36);
  }

  function renumberNames() {
    // Only rewrite default-style names so user renames (e.g. "Hook") stay put.
    takes.forEach((t, i) => {
      if (/^Take \d+$/.test(t.name)) {
        t.name = "Take " + (i + 1);
      }
    });
  }

  function findTake(id) {
    return takes.find((t) => t.id === id) || null;
  }

  function selectedTake() {
    return selectedId ? findTake(selectedId) : null;
  }

  function relativeNow() {
    return Math.max(0, Tone.now() - recordStartTime);
  }

  function clipDuration(notes) {
    if (!notes || !notes.length) return 0;
    return notes.reduce((max, n) => Math.max(max, n.start + n.duration), 0);
  }

  function notify() {
    onChange(getSummary());
  }

  // ---------------------------------------------------------------------------
  // Recording – always a NEW take
  // ---------------------------------------------------------------------------

  function startRecording() {
    if (state === "playing") stopPlayback();
    if (state === "recording") return;

    openNotes.clear();
    recordingNotes = [];
    recordingTakeId = makeId();
    recordStartTime = Tone.now();
    state = "recording";

    console.log("[ClipRecorder] recording new take", recordingTakeId);
    notify();
  }

  function stopRecording() {
    if (state !== "recording") return;

    const now = relativeNow();

    openNotes.forEach((pending) => {
      recordingNotes.push({
        pitch: pending.pitch,
        start: pending.start,
        duration: Math.max(0.01, now - pending.start),
        velocity: pending.velocity
      });
    });
    openNotes.clear();
    recordingNotes.sort((a, b) => a.start - b.start);

    const newTake = {
      id: recordingTakeId,
      name: "Take " + (takes.length + 1),
      notes: recordingNotes.slice()
    };

    takes.push(newTake);
    selectedId = newTake.id;
    recordingTakeId = null;
    recordingNotes = [];
    state = "idle";

    // Ensure sequential names
    renumberNames();

    console.log(
      "[ClipRecorder] take saved:",
      newTake.name,
      "–",
      newTake.notes.length,
      "notes,",
      clipDuration(newTake.notes).toFixed(2),
      "s · library size",
      takes.length
    );
    notify();
  }

  function noteOn(midi, velocity = 0.85) {
    if (state !== "recording") return;

    const t = relativeNow();

    // Mono: close any open note at this instant
    openNotes.forEach((pending, prevMidi) => {
      recordingNotes.push({
        pitch: pending.pitch,
        start: pending.start,
        duration: Math.max(0.01, t - pending.start),
        velocity: pending.velocity
      });
      openNotes.delete(prevMidi);
    });

    openNotes.set(midi, { pitch: midi, start: t, velocity });
  }

  function noteOff(midi) {
    if (state !== "recording") return;
    const pending = openNotes.get(midi);
    if (!pending) return;

    const t = relativeNow();
    recordingNotes.push({
      pitch: pending.pitch,
      start: pending.start,
      duration: Math.max(0.01, t - pending.start),
      velocity: pending.velocity
    });
    openNotes.delete(midi);
    notify();
  }

  // ---------------------------------------------------------------------------
  // Selection / delete / rename
  // ---------------------------------------------------------------------------

  function selectTake(id) {
    if (state === "recording") {
      console.warn("[ClipRecorder] cannot switch takes while recording");
      return false;
    }
    if (state === "playing") stopPlayback();

    if (!findTake(id)) {
      console.warn("[ClipRecorder] take not found", id);
      return false;
    }
    selectedId = id;
    console.log("[ClipRecorder] selected", findTake(id).name);
    notify();
    return true;
  }

  function deleteSelected() {
    if (state === "recording") return false;
    if (state === "playing") stopPlayback();
    if (!selectedId) return false;

    const idx = takes.findIndex((t) => t.id === selectedId);
    if (idx < 0) return false;

    const removed = takes.splice(idx, 1)[0];
    renumberNames();

    // Select neighbor
    if (takes.length === 0) {
      selectedId = null;
    } else if (idx >= takes.length) {
      selectedId = takes[takes.length - 1].id;
    } else {
      selectedId = takes[idx].id;
    }

    console.log("[ClipRecorder] deleted", removed.name, "· remaining", takes.length);
    notify();
    return true;
  }

  function renameSelected(newName) {
    const take = selectedTake();
    if (!take) return false;
    const trimmed = String(newName || "").trim();
    if (!trimmed) return false;
    take.name = trimmed;
    console.log("[ClipRecorder] renamed →", take.name);
    notify();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Playback of selected take
  // ---------------------------------------------------------------------------

  function playClip() {
    const take = selectedTake();
    if (!take || !take.notes.length) {
      console.warn("[ClipRecorder] nothing to play");
      return;
    }
    if (state === "recording") return;
    if (state === "playing") stopPlayback();

    const transport = Tone.getTransport();
    transport.cancel(0);
    transport.position = 0;

    const events = take.notes.map((n) => [
      n.start,
      { pitch: n.pitch, duration: n.duration, velocity: n.velocity }
    ]);

    playPart = new Tone.Part((time, value) => {
      MonoSynthEngine.triggerAttackRelease(
        value.pitch,
        value.duration,
        time,
        value.velocity
      );
    }, events);

    playPart.start(0);

    const end = clipDuration(take.notes) + 0.2;
    transport.scheduleOnce(() => stopPlayback(), end);
    transport.start();

    state = "playing";
    console.log("[ClipRecorder] playing", take.name, take.notes.length, "notes");
    notify();
  }

  function stopPlayback() {
    if (playPart) {
      try {
        playPart.stop();
        playPart.dispose();
      } catch (e) {
        /* ignore */
      }
      playPart = null;
    }
    MonoSynthEngine.allNotesOff();

    const transport = Tone.getTransport();
    transport.cancel(0);
    if (transport.state === "started") transport.stop();
    transport.position = 0;

    if (state === "playing") {
      state = "idle";
      console.log("[ClipRecorder] playback stopped");
      notify();
    }
  }

  function onPanic() {
    if (state === "recording" && openNotes.size > 0) {
      const t = relativeNow();
      openNotes.forEach((pending) => {
        recordingNotes.push({
          pitch: pending.pitch,
          start: pending.start,
          duration: Math.max(0.01, t - pending.start),
          velocity: pending.velocity
        });
      });
      openNotes.clear();
      notify();
    }
    if (state === "playing") stopPlayback();
  }

  // ---------------------------------------------------------------------------
  // Public summary for UI
  // ---------------------------------------------------------------------------

  function getSummary() {
    const take = selectedTake();
    const notes = take ? take.notes : [];
    const liveCount =
      state === "recording" ? recordingNotes.length + openNotes.size : 0;

    return {
      state,
      takes: takes.map((t) => ({
        id: t.id,
        name: t.name,
        noteCount: t.notes.length,
        duration: clipDuration(t.notes)
      })),
      selectedId,
      selectedName: take ? take.name : null,
      noteCount: state === "recording" ? liveCount : notes.length,
      duration: state === "recording" ? relativeNow() : clipDuration(notes),
      hasClip: !!(take && take.notes.length),
      takeCount: takes.length
    };
  }

  function getSelectedNotes() {
    const take = selectedTake();
    return take ? take.notes.map((n) => ({ ...n })) : [];
  }

  function getState() {
    return state;
  }

  function setOnChange(fn) {
    onChange = typeof fn === "function" ? fn : () => {};
  }

  return {
    startRecording,
    stopRecording,
    playClip,
    stopPlayback,
    noteOn,
    noteOff,
    onPanic,
    selectTake,
    deleteSelected,
    renameSelected,
    getSelectedNotes,
    getState,
    getSummary,
    setOnChange
  };
})();
