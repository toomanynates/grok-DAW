/**
 * transport.js
 * Chunk 2.5 – Record / Stop / Play / Delete + multi-take strip.
 *
 * ‹ › select previous / next take (not page).
 * Take list stays on one horizontal line (scroll if needed).
 *
 * Shortcuts: R = toggle record, Space = play/stop selected take.
 */

const TransportUI = (function () {
  "use strict";

  let btnRecord;
  let btnStop;
  let btnPlay;
  let btnDelete;
  let btnRename;
  let btnPrev;
  let btnNext;
  let takesList;
  let stateEl;
  let metaEl;

  function updateUI(summary) {
    if (!summary) summary = ClipRecorder.getSummary();

    const {
      state,
      takes,
      selectedId,
      noteCount,
      duration,
      hasClip,
      takeCount
    } = summary;

    if (stateEl) {
      const labels = {
        idle: takeCount ? "Ready" : "Idle",
        recording: "Recording…",
        playing: "Playing…"
      };
      stateEl.textContent = labels[state] || state;
      stateEl.dataset.state = state;
    }

    if (metaEl) {
      if (state === "recording") {
        metaEl.textContent = `${noteCount} notes · ${duration.toFixed(1)}s`;
      } else if (selectedId) {
        metaEl.textContent = `${takeCount} take${takeCount === 1 ? "" : "s"} · ${noteCount} notes · ${duration.toFixed(1)}s`;
      } else {
        metaEl.textContent = `${takeCount} take${takeCount === 1 ? "" : "s"}`;
      }
    }

    if (btnRecord) {
      btnRecord.classList.toggle("transport__btn--armed", state === "recording");
      btnRecord.disabled = state === "playing";
      const label = btnRecord.querySelector("span");
      if (label) label.textContent = state === "recording" ? "Recording" : "Record";
    }
    if (btnStop) btnStop.disabled = state === "idle";
    if (btnPlay) {
      btnPlay.disabled = !hasClip || state === "recording";
      btnPlay.classList.toggle("transport__btn--active", state === "playing");
    }
    if (btnDelete) {
      btnDelete.disabled = !selectedId || state === "recording" || state === "playing";
    }
    if (btnRename) {
      btnRename.disabled = !selectedId || state === "recording" || state === "playing";
    }

    renderTakes(takes, selectedId, state);
  }

  function renderTakes(takes, selectedId, state) {
    if (!takesList) return;

    takesList.innerHTML = "";

    if (!takes.length) {
      const empty = document.createElement("span");
      empty.className = "takes__empty";
      empty.textContent = "—";
      takesList.appendChild(empty);
    } else {
      takes.forEach((t) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "takes__chip";
        btn.setAttribute("role", "option");
        btn.dataset.id = t.id;
        btn.textContent = t.name;
        btn.title = `${t.duration.toFixed(1)}s · ${t.noteCount} note${t.noteCount === 1 ? "" : "s"}`;
        btn.setAttribute("aria-selected", t.id === selectedId ? "true" : "false");
        if (t.id === selectedId) btn.classList.add("takes__chip--selected");
        if (state === "recording") {
          btn.disabled = true;
          btn.classList.add("takes__chip--locked");
        }
        btn.addEventListener("click", () => ClipRecorder.selectTake(t.id));
        takesList.appendChild(btn);
      });

      // Scroll selected chip into view (same row, no layout jump)
      requestAnimationFrame(() => {
        const sel = takesList.querySelector(".takes__chip--selected");
        if (sel && typeof sel.scrollIntoView === "function") {
          sel.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
        }
      });
    }

    // ‹ › = previous / next take in the list
    const idx = takes.findIndex((t) => t.id === selectedId);
    const locked = state === "recording";
    if (btnPrev) {
      btnPrev.disabled = locked || idx <= 0 || takes.length === 0;
    }
    if (btnNext) {
      btnNext.disabled = locked || idx < 0 || idx >= takes.length - 1;
    }
  }

  function selectRelative(delta) {
    if (ClipRecorder.getState() === "recording") return;
    const summary = ClipRecorder.getSummary();
    const { takes, selectedId } = summary;
    if (!takes.length) return;

    let idx = takes.findIndex((t) => t.id === selectedId);
    if (idx < 0) idx = 0;
    const next = Math.max(0, Math.min(takes.length - 1, idx + delta));
    if (takes[next]) ClipRecorder.selectTake(takes[next].id);
  }

  function onRecord() {
    if (!MonoSynthEngine.isReady()) {
      console.warn("[TransportUI] audio not ready");
      return;
    }
    if (ClipRecorder.getState() === "recording") {
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
    if (ClipRecorder.getState() === "playing") {
      ClipRecorder.stopPlayback();
    } else {
      ClipRecorder.playClip();
    }
  }

  function onDelete() {
    const summary = ClipRecorder.getSummary();
    if (!summary.selectedId) return;
    const name = summary.selectedName || "this take";
    if (!window.confirm(`Delete ${name}?`)) return;
    ClipRecorder.deleteSelected();
  }

  function onRename() {
    const summary = ClipRecorder.getSummary();
    if (!summary.selectedId) return;
    const current = summary.selectedName || "";
    const next = window.prompt("Rename take:", current);
    if (next === null) return;
    ClipRecorder.renameSelected(next);
  }

  function bindShortcuts() {
    window.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "Space") {
        e.preventDefault();
        onPlay();
        return;
      }
      if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onRecord();
      }
    });
  }

  function init() {
    btnRecord = document.getElementById("btn-record");
    btnStop = document.getElementById("btn-stop");
    btnPlay = document.getElementById("btn-play");
    btnDelete = document.getElementById("btn-delete");
    btnRename = document.getElementById("btn-rename");
    btnPrev = document.getElementById("takes-prev");
    btnNext = document.getElementById("takes-next");
    takesList = document.getElementById("takes-list");
    stateEl = document.getElementById("transport-state");
    metaEl = document.getElementById("transport-meta");

    if (btnRecord) btnRecord.addEventListener("click", onRecord);
    if (btnStop) btnStop.addEventListener("click", onStop);
    if (btnPlay) btnPlay.addEventListener("click", onPlay);
    if (btnDelete) btnDelete.addEventListener("click", onDelete);
    if (btnRename) btnRename.addEventListener("click", onRename);
    if (btnPrev) btnPrev.addEventListener("click", () => selectRelative(-1));
    if (btnNext) btnNext.addEventListener("click", () => selectRelative(1));

    ClipRecorder.setOnChange(updateUI);
    bindShortcuts();
    updateUI();

    console.log("[TransportUI] initialized (prev/next take)");
  }

  return { init, updateUI };
})();
