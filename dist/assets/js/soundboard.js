(function () {
  "use strict";

  const STORAGE_KEY = "pocket-playroom.sound.v1";
  const SOUNDS = {
    move: [[330, .035, 0, .018, "square"]],
    confirm: [[440, .045, 0, .022, "square"], [660, .06, .055, .018, "square"]],
    back: [[330, .04, 0, .018, "square"], [220, .06, .05, .015, "square"]],
    deal: [[260, .025, 0, .012, "square"], [330, .03, .035, .01, "square"]],
    draw: [[294, .06, 0, .018, "triangle"], [392, .07, .07, .014, "square"]],
    pair: [[523, .055, 0, .02, "square"], [659, .055, .065, .018, "square"], [784, .09, .13, .016, "square"]],
    discard: [[220, .035, 0, .014, "square"], [165, .06, .04, .012, "triangle"]],
    shuffle: [[196, .035, 0, .012, "square"], [247, .035, .05, .01, "square"], [196, .035, .10, .012, "square"], [294, .05, .15, .01, "square"]],
    slide: [[392, .035, 0, .014, "square"], [330, .035, .035, .01, "triangle"]],
    flip: [[220, .025, 0, .012, "square"], [440, .045, .028, .012, "triangle"]],
    hold: [[392, .04, 0, .014, "square"], [523, .05, .045, .012, "square"]],
    coin: [[784, .04, 0, .014, "square"], [988, .08, .05, .012, "square"]],
    tick: [[880, .018, 0, .008, "square"]],
    start: [[262, .055, 0, .016, "square"], [330, .055, .07, .014, "square"], [392, .08, .14, .012, "square"]],
    win: [[523, .08, 0, .018, "square"], [659, .08, .10, .016, "square"], [784, .08, .20, .014, "square"], [1047, .18, .30, .012, "triangle"]],
    lose: [[294, .09, 0, .016, "triangle"], [247, .10, .11, .014, "square"], [196, .18, .23, .011, "triangle"]]
  };

  let context = null;
  let master = null;
  let enabled = readPreference();

  function readPreference() {
    try { return localStorage.getItem(STORAGE_KEY) !== "off"; }
    catch (_) { return true; }
  }

  function ensureAudio() {
    if (!context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = .7;
      master.connect(context.destination);
    }
    if (context.state === "suspended") context.resume();
    return true;
  }

  function play(name) {
    if (!enabled || !SOUNDS[name] || !ensureAudio()) return;
    const now = context.currentTime;
    SOUNDS[name].forEach(([frequency, duration, offset, volume, type]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      gain.gain.setValueAtTime(.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(volume, now + offset + .006);
      gain.gain.exponentialRampToValueAtTime(.0001, now + offset + duration);
      oscillator.connect(gain).connect(master);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + duration + .01);
    });
  }

  function setEnabled(next) {
    enabled = Boolean(next);
    try { localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off"); } catch (_) {}
    document.dispatchEvent(new CustomEvent("pocket-soundchange", { detail: { enabled } }));
    syncToggles();
    if (enabled) play("start");
    return enabled;
  }

  function toggle() { return setEnabled(!enabled); }

  function syncToggles() {
    document.querySelectorAll("[data-sound-toggle]").forEach((button) => {
      button.textContent = enabled ? "♪ SOUND ON" : "♪ SOUND OFF";
      button.setAttribute("aria-pressed", String(enabled));
    });
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sound-toggle]");
    if (button) toggle();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", syncToggles);
  else syncToggles();

  window.PocketSound = Object.freeze({ play, toggle, setEnabled, isEnabled: () => enabled, sounds: Object.keys(SOUNDS) });
})();
