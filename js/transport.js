/**
 * transport.js
 * Chunk 2 UI for Record / Stop / Play / Clear and status display.
 * Keyboard shortcuts: R = toggle record, Space = play/stop (when not typing).
 */

const TransportUI = (function () {
  "use strict";

  let btnRecord;
  let btnStop;
  let btnPlay;
  let btnClear;
  let stateEl;
  let metaEl;

  function updateUI(summary) {
    if (!summary) summary = ClipRecorder.getSummary();

    const { state, noteCount, duration, hasClip } = summary;

    if (stateEl) {
      const labels = {
        idle: hasClip ? "Clip ready" : "Idle",
        recording: "Recording…",
        playing: "Playing…"
      };
      stateEl.textContent = labels[state] || state;
      stateEl.dataset.state = state;
    }

    if (metaEl) {
      metaEl.textContent = `${noteCount} note${noteCount === 1 ? "" : "s"} · ${duration.toFixed(1)}s`;
    }

    if (btnRecord) {
      btnRecord.classList.toggle("transport__btn--armed", state === "recording");
      btnRecord.disabled = state === "playing";
      const label = btnRecord.querySelector("span");
      if (label) label.textContent = state === "recording" ? "Recording" : "Record";
    }
    if (btnStop) {
      btnStop.disabled = state === "idle";
    }
    if (btnPlay) {
      btnPlay.disabled = !hasClip || state === "recording";
      btnPlay.classList.toggle("transport__btn--active", state === "playing");
    }
    if (btnClear) {
      btnClear.disabled = (!hasClip && noteCount === 0) || state === "recording";
    }
  }

  function onRecord() {
    if (!MonoSynthEngine.isReady()) {
      console.warn("[TransportUI] audio not ready");
      return;
    }
    const s = ClipRecorder.getState();
    if (s === "recording") {
      ClipRecorder.stopRecording();
    } else {
      ClipRecorder.startRecording();
    }
  }

  function onStop() {
    const s = ClipRecorder.getState();
    if (s === "recording") ClipRecorder.stopRecording();
    else if (s === "playing") ClipRecorder.stopPlayback();
  }

  function onPlay() {
    if (!MonoSynthEngine.isReady()) return;
    const s = ClipRecorder.getState();
    if (s === "playing") {
      ClipRecorder.stopPlayback();
    } else {
      ClipRecorder.playClip();
    }
  }

  function onClear() {
    ClipRecorder.clearClip();
  }

  function bindShortcuts() {
    window.addEventListener("keydown", (e) => {
      // Ignore when focus is on inputs (future-proof)
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "Space") {
        e.preventDefault();
        onPlay();
        return;
      }
      if (e.key === "r" || e.key === "R") {
        // Don't steal R if modifier keys are held
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        onRecord();
      }
    });
  }

  function init() {
    btnRecord = document.getElementById("btn-record");
    btnStop = document.getElementById("btn-stop");
    btnPlay = document.getElementById("btn-play");
    btnClear = document.getElementById("btn-clear");
    stateEl = document.getElementById("transport-state");
    metaEl = document.getElementById("transport-meta");

    if (btnRecord) btnRecord.addEventListener("click", onRecord);
    if (btnStop) btnStop.addEventListener("click", onStop);
    if (btnPlay) btnPlay.addEventListener("click", onPlay);
    if (btnClear) btnClear.addEventListener("click", onClear);

    ClipRecorder.setOnChange(updateUI);
    bindShortcuts();
    updateUI();

    console.log("[TransportUI] initialized");
  }

  return {
    init,
    updateUI
  };
})();
