(function () {
  "use strict";

  const KEY_MAP = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    Enter: "a", " ": "b", z: "a", Z: "a", Escape: "b", x: "b", X: "b",
    q: "select", Q: "select", s: "start", S: "start"
  };
  const HOLD_MS = 3000;
  let resetTimer = 0;
  let resetStartedAt = 0;
  let resetButton = null;
  let overlayHideTimer = 0;
  const touchTimes = new WeakMap();
  const activePointers = new Map();
  const activeKeys = new Map();

  function emit(action, source) {
    document.dispatchEvent(new CustomEvent("pocket-input", { detail: { action, source } }));
  }

  function emitHold(type, action, source) {
    document.dispatchEvent(new CustomEvent(`pocket-input-${type}`, { detail: { action, source } }));
  }

  function showKeyboardGuide() {
    let guide = document.querySelector(".keyboard-guide");
    if (!guide) {
      guide = document.createElement("div");
      guide.className = "keyboard-guide";
      guide.textContent = "KEYBOARD  矢印:十字 / ENTER:A / SPACE:B";
      document.querySelector(".console")?.append(guide);
    }
    document.querySelector(".console")?.classList.add("has-keyboard");
    guide.hidden = false;
  }

  function resetOverlay() {
    let overlay = document.querySelector(".reset-safety");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "reset-safety";
    overlay.hidden = true;
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "assertive");
    overlay.innerHTML = "<strong>RESETまで長押ししてください</strong><span>[3...]</span>";
    document.querySelector(".screen")?.append(overlay);
    return overlay;
  }

  function showResetOverlay(seconds, progress = 0) {
    const overlay = resetOverlay();
    window.clearTimeout(overlayHideTimer);
    overlay.hidden = false;
    overlay.style.setProperty("--reset-progress", `${Math.min(100, progress)}%`);
    overlay.querySelector("strong").textContent = "RESETまで長押ししてください";
    overlay.querySelector("span").textContent = `[${seconds}...]`;
  }

  function hideResetOverlay(delay = 0) {
    window.clearTimeout(overlayHideTimer);
    overlayHideTimer = window.setTimeout(() => { resetOverlay().hidden = true; }, delay);
  }

  function stopResetHold(completed = false) {
    if (!resetTimer) return;
    window.clearInterval(resetTimer);
    resetTimer = 0;
    resetButton?.classList.remove("is-holding");
    resetButton = null;
    if (!completed) {
      showResetOverlay(3, 0);
      window.PocketSound?.play("back");
      hideResetOverlay(900);
    }
  }

  function startResetHold(button) {
    if (resetTimer) return;
    resetButton = button;
    resetStartedAt = performance.now();
    button.classList.add("is-holding");
    showResetOverlay(3, 0);
    resetTimer = window.setInterval(() => {
      const elapsed = performance.now() - resetStartedAt;
      const remaining = Math.max(1, Math.ceil((HOLD_MS - elapsed) / 1000));
      showResetOverlay(remaining, elapsed / HOLD_MS * 100);
      if (elapsed < HOLD_MS) return;
      const overlay = resetOverlay();
      window.clearInterval(resetTimer);
      resetTimer = 0;
      button.classList.remove("is-holding");
      resetButton = null;
      overlay.querySelector("strong").textContent = "RESET";
      overlay.querySelector("span").textContent = "[OK]";
      overlay.style.setProperty("--reset-progress", "100%");
      window.PocketSound?.play("confirm");
      document.dispatchEvent(new CustomEvent("pocket-reset"));
      hideResetOverlay(650);
    }, 80);
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-hold-reset]")) {
      event.preventDefault();
      return;
    }
    const control = event.target.closest("[data-control]");
    if (!control || control.disabled) return;
    if (event.detail > 0 && performance.now() - (touchTimes.get(control) || 0) < 700) return;
    emit(control.dataset.control, "hardware");
  });

  document.addEventListener("pointerdown", (event) => {
    const button = event.target.closest("[data-hold-reset]");
    if (button && !button.disabled) {
      event.preventDefault();
      button.focus();
      button.setPointerCapture?.(event.pointerId);
      startResetHold(button);
      return;
    }
    const control = event.target.closest("[data-control]");
    if (!control || control.disabled) return;
    event.preventDefault();
    control.setPointerCapture?.(event.pointerId);
    touchTimes.set(control, performance.now());
    const source = event.pointerType === "mouse" ? "hardware" : "touch";
    activePointers.set(event.pointerId, { action: control.dataset.control, source });
    emit(control.dataset.control, source);
    emitHold("start", control.dataset.control, source);
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => {
    document.addEventListener(type, (event) => {
      const held = activePointers.get(event.pointerId);
      if (held) {
        activePointers.delete(event.pointerId);
        emitHold("end", held.action, held.source);
      }
      stopResetHold(false);
    });
  });

  document.addEventListener("keydown", (event) => {
    const button = event.target.closest?.("[data-hold-reset]");
    if (!button || !["Enter", " "].includes(event.key) || event.repeat) return;
    event.preventDefault();
    startResetHold(button);
  });
  document.addEventListener("keyup", (event) => {
    const button = event.target.closest?.("[data-hold-reset]");
    if (!button || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    stopResetHold(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const action = KEY_MAP[event.key];
    if (!action) return;
    showKeyboardGuide();
    if (["SELECT", "INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
    const alwaysUseGameKeys = document.querySelector("[data-keyboard-controls-always]");
    if (!alwaysUseGameKeys && ["BUTTON", "A"].includes(event.target.tagName) && ["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    emit(action, "keyboard");
    activeKeys.set(event.code, action);
    emitHold("start", action, "keyboard");
  });

  document.addEventListener("keyup", (event) => {
    const action = activeKeys.get(event.code);
    if (!action) return;
    activeKeys.delete(event.code);
    emitHold("end", action, "keyboard");
  });

  window.PocketControls = Object.freeze({ emit });
})();
