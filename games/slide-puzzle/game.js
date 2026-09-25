(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const sound = (name) => window.PocketSound?.play(name);
  const ui = {
    board: $("#puzzle-board"), moves: $("#move-count"), time: $("#time-count"), status: $("#puzzle-status"),
    size: $("#size-select"), mode: $("#puzzle-mode"),
    result: $("#puzzle-result"), resultRecord: $("#result-record"), again: $("#again-button")
  };
  let size = 4;
  let tiles = [];
  let moves = 0;
  let startedAt = 0;
  let elapsed = 0;
  let running = false;
  let inputLocked = false;
  let paused = false;
  let gameToken = 0;
  let hintTimer = 0;

  function solvedTiles() { return [...Array(size * size - 1)].map((_, index) => index + 1).concat(0); }

  function shuffledTiles() {
    const next = solvedTiles();
    let blank = next.length - 1;
    let previous = -1;
    const steps = size * size * 32;
    for (let i = 0; i < steps; i += 1) {
      const row = Math.floor(blank / size);
      const col = blank % size;
      const choices = [];
      if (row > 0) choices.push(blank - size);
      if (row < size - 1) choices.push(blank + size);
      if (col > 0) choices.push(blank - 1);
      if (col < size - 1) choices.push(blank + 1);
      const filtered = choices.filter((index) => index !== previous);
      const target = filtered[Math.floor(Math.random() * filtered.length)];
      [next[blank], next[target]] = [next[target], next[blank]];
      previous = blank;
      blank = target;
    }
    return next;
  }

  function formatTime(milliseconds) {
    const totalTenths = Math.floor(milliseconds / 100);
    const minutes = Math.floor(totalTenths / 600);
    const seconds = Math.floor((totalTenths % 600) / 10);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${totalTenths % 10}`;
  }

  function render() {
    ui.board.style.setProperty("--n", String(size));
    ui.mode.textContent = `${size} × ${size}`;
    ui.moves.textContent = String(moves).padStart(3, "0");
    ui.size.disabled = inputLocked || moves > 0 || running;
    ui.size.closest(".size-picker")?.classList.toggle("is-locked", moves > 0 || running);
    const existing = new Map([...ui.board.children].map((tile) => [Number(tile.dataset.value), tile]));

    tiles.forEach((value, index) => {
      if (value === 0) return;
      let tile = existing.get(value);
      if (!tile) {
        tile = document.createElement("button");
        tile.type = "button";
        tile.className = "puzzle-tile";
        tile.dataset.value = String(value);
        tile.innerHTML = `<span>${value}</span>`;
        tile.addEventListener("click", () => moveTile(Number(tile.dataset.value)));
        ui.board.append(tile);
      }
      const row = Math.floor(index / size);
      const col = index % size;
      tile.style.transform = `translate(${col * 100}%, ${row * 100}%)`;
      tile.style.setProperty("--tile-index", String(value));
      tile.style.setProperty("--tile-delay", `${value * 25}ms`);
      tile.disabled = inputLocked || paused;
      tile.setAttribute("aria-label", `タイル ${value}`);
      existing.delete(value);
    });
    existing.forEach((tile) => tile.remove());
  }

  async function newGame() {
    gameToken += 1;
    const token = gameToken;
    running = false;
    inputLocked = true;
    paused = false;
    moves = 0;
    elapsed = 0;
    startedAt = 0;
    ui.result.hidden = true;
    ui.board.classList.remove("is-complete");
    tiles = solvedTiles();
    ui.status.textContent = "タイルを混ぜています…";
    ui.time.textContent = formatTime(0);
    render();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (token !== gameToken) return;
    ui.board.classList.add("is-shuffling");
    sound("shuffle");
    tiles = shuffledTiles();
    render();
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    if (token !== gameToken) return;
    ui.board.classList.remove("is-shuffling");
    inputLocked = false;
    ui.status.textContent = "タイルをタップ、または十字キーで動かそう";
    render();
  }

  function startTimer() {
    if (running) return;
    running = true;
    startedAt = performance.now() - elapsed;
  }

  function indicesAreAdjacent(a, b) {
    const ar = Math.floor(a / size), ac = a % size;
    const br = Math.floor(b / size), bc = b % size;
    return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
  }

  function moveTile(value) {
    if (inputLocked || paused) return;
    const tileIndex = tiles.indexOf(value);
    const blankIndex = tiles.indexOf(0);
    if (!indicesAreAdjacent(tileIndex, blankIndex)) {
      sound("back");
      return;
    }
    startTimer();
    [tiles[tileIndex], tiles[blankIndex]] = [tiles[blankIndex], tiles[tileIndex]];
    moves += 1;
    sound("slide");
    render();
    checkComplete();
  }

  function moveByDirection(direction) {
    if (inputLocked || paused) return;
    const blank = tiles.indexOf(0);
    const row = Math.floor(blank / size);
    const col = blank % size;
    let target = -1;
    if (direction === "up" && row < size - 1) target = blank + size;
    if (direction === "down" && row > 0) target = blank - size;
    if (direction === "left" && col < size - 1) target = blank + 1;
    if (direction === "right" && col > 0) target = blank - 1;
    if (target >= 0) moveTile(tiles[target]);
    else sound("back");
  }

  function checkComplete() {
    if (!tiles.every((value, index) => value === (index + 1) % tiles.length)) return;
    running = false;
    inputLocked = true;
    elapsed = performance.now() - startedAt;
    ui.time.textContent = formatTime(elapsed);
    ui.board.classList.add("is-complete");
    ui.status.textContent = "パズル完成！";
    ui.resultRecord.textContent = `${moves}手 / ${formatTime(elapsed)}`;
    ui.result.hidden = false;
    sound("win");
    ui.again.focus();
    render();
  }

  function togglePause() {
    if (inputLocked) return;
    if (!startedAt) {
      ui.status.textContent = "最初の一手でタイマー開始";
      sound("back");
      return;
    }
    paused = !paused;
    if (paused) {
      elapsed = performance.now() - startedAt;
      running = false;
      ui.status.textContent = "PAUSE — STARTをタップ、またはSで再開";
      sound("back");
    } else {
      startedAt = performance.now() - elapsed;
      running = true;
      ui.status.textContent = "タップ、または十字キーで続けよう";
      sound("confirm");
    }
    render();
  }

  function showHint() {
    if (inputLocked || paused) return;
    window.clearTimeout(hintTimer);
    const blank = tiles.indexOf(0);
    const movable = tiles.filter((value, index) => value && indicesAreAdjacent(index, blank));
    document.querySelectorAll(".puzzle-tile").forEach((tile) => tile.classList.toggle("is-hint", movable.includes(Number(tile.dataset.value))));
    ui.status.textContent = "光ったタイルをタップ、または十字キーで移動";
    sound("tick");
    hintTimer = window.setTimeout(() => document.querySelectorAll(".puzzle-tile.is-hint").forEach((tile) => tile.classList.remove("is-hint")), 900);
  }

  function cycleSize() {
    if (moves > 0 || running) {
      ui.status.textContent = "ゲーム開始後はSIZEを変更できません";
      sound("back");
      return;
    }
    size = size === 5 ? 3 : size + 1;
    ui.size.value = String(size);
    newGame();
  }

  window.setInterval(() => {
    if (!running) return;
    elapsed = performance.now() - startedAt;
    ui.time.textContent = formatTime(elapsed);
  }, 100);

  ui.size.addEventListener("change", () => { size = Number(ui.size.value); newGame(); });
  ui.again.addEventListener("click", newGame);
  document.addEventListener("pocket-reset", newGame);
  document.addEventListener("pocket-input", (event) => {
    const action = event.detail.action;
    if (["up", "down", "left", "right"].includes(action)) moveByDirection(action);
    else if (action === "a") showHint();
    else if (action === "select") cycleSize();
    else if (action === "start") togglePause();
    else if (action === "b") { sound("back"); window.setTimeout(() => { window.location.href = "../../"; }, 90); }
  });

  newGame();
})();
