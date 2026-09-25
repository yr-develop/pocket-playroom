(function () {
  "use strict";

  const FRAME_WIDTH = 430;
  const FRAME_HEIGHT = 800;
  const EDGE_GAP = 16;

  function fitConsole() {
    const scale = Math.min(1, (window.innerWidth - EDGE_GAP) / FRAME_WIDTH, (window.innerHeight - EDGE_GAP) / FRAME_HEIGHT);
    document.documentElement.style.setProperty("--console-scale", String(Math.max(.25, scale)));
  }

  fitConsole();
  window.addEventListener("resize", fitConsole, { passive: true });
  window.addEventListener("orientationchange", fitConsole, { passive: true });
})();
