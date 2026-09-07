/**
 * main.js
 * Entry point – Mini-DAW Play mode (Tone.MonoSynth).
 */

(function () {
  "use strict";

  const overlay = document.getElementById("start-overlay");
  const startBtn = document.getElementById("start-btn");
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");

  function setStatus(ready) {
    if (statusDot) {
      statusDot.classList.toggle("header__status-dot--active", ready);
    }
    if (statusText) {
      statusText.textContent = ready ? "Audio ready" : "Audio locked";
    }
  }

  function hideOverlay() {
    if (!overlay) return;
    overlay.classList.add("overlay--hidden");
    setTimeout(() => {
      overlay.style.display = "none";
    }, 250);
  }

  async function unlockAndStart() {
    console.log("[main] Unlock requested");
    const ok = await MonoSynthEngine.unlock();
    if (!ok) {
      console.error("[main] Tone.start failed");
      if (statusText) statusText.textContent = "Audio failed – try again";
      return;
    }
    setStatus(true);
    hideOverlay();
    ControlsUI.startMeter();
    console.log("[main] MonoSynth live");
  }

  function boot() {
    console.log("[main] Boot – initializing UI modules");

    // UI first (no audio yet)
    ControlsUI.init();
    KeyboardUI.init();
    TransportUI.init();
    setStatus(false);

    if (startBtn) {
      startBtn.addEventListener("click", unlockAndStart);
    }

    // Secondary unlock path: first key / click after a short delay
    const gestureHandler = async (e) => {
      if (e.target === startBtn || (startBtn && startBtn.contains(e.target))) return;
      window.removeEventListener("keydown", gestureHandler);
      window.removeEventListener("pointerdown", gestureHandler);
      await unlockAndStart();
    };
    setTimeout(() => {
      window.addEventListener("keydown", gestureHandler, { once: true });
      window.addEventListener("pointerdown", gestureHandler, { once: true });
    }, 300);

    console.log("[main] Waiting for user gesture");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
