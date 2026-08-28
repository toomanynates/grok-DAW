/**
 * main.js
 * Entry point for Mini-DAW Chunk 1 – Playable Synth.
 *
 * Responsibilities:
 *  - Wait for DOM
 *  - Initialize modules
 *  - Handle the required user-gesture unlock of AudioContext
 *  - Update status indicator
 */

(function () {
  "use strict";

  const overlay = document.getElementById("start-overlay");
  const startBtn = document.getElementById("start-btn");
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");

  /**
   * Update the header status indicator.
   */
  function setStatus(ready) {
    if (statusDot) {
      statusDot.classList.toggle("header__status-dot--active", ready);
    }
    if (statusText) {
      statusText.textContent = ready ? "Audio ready" : "Audio locked";
    }
  }

  /**
   * Hide the start overlay with a short fade.
   */
  function hideOverlay() {
    if (!overlay) return;
    overlay.classList.add("overlay--hidden");
    // Remove from tab order after transition
    setTimeout(() => {
      overlay.style.display = "none";
    }, 250);
  }

  /**
   * Unlock audio and start the UI.
   */
  async function unlockAndStart() {
    console.log("[main] Unlock requested by user gesture");

    const ok = await SynthEngine.unlock();
    if (!ok) {
      console.error("[main] Failed to resume AudioContext");
      statusText.textContent = "Audio failed – try again";
      return;
    }

    setStatus(true);
    hideOverlay();
    UIControls.startMeter();

    console.log("[main] Synth is live. Play with on-screen keys or computer keyboard.");
    console.log("[main] Mapping: A S D F G H J K (white)  W E T Y U (black)  Z/X octave");
  }

  /**
   * Bootstrap
   */
  function boot() {
    console.log("[main] DOM ready – initializing modules");

    // Initialize UI modules (they do not start audio yet)
    KeyboardUI.init();
    UIControls.init();

    setStatus(false);

    // Primary unlock path – button
    if (startBtn) {
      startBtn.addEventListener("click", unlockAndStart);
    }

    // Also allow first keydown or pointer on the page to unlock
    // (once unlocked we remove these listeners)
    const gestureHandler = async (e) => {
      // Ignore if the click was on the start button (already handled)
      if (e.target === startBtn || startBtn.contains(e.target)) return;

      console.log("[main] Gesture detected outside overlay button – unlocking");
      window.removeEventListener("keydown", gestureHandler);
      window.removeEventListener("pointerdown", gestureHandler);
      await unlockAndStart();
    };

    // We only attach the global gesture listeners after a short delay
    // so the explicit "Start Synth" button remains the primary path.
    // Users who click keys immediately will still unlock.
    setTimeout(() => {
      window.addEventListener("keydown", gestureHandler, { once: true });
      window.addEventListener("pointerdown", gestureHandler, { once: true });
    }, 300);

    console.log("[main] Ready – waiting for user gesture to unlock audio");
  }

  // ---------------------------------------------------------------------------
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
