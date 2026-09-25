(function () {
  "use strict";

  const WIDTH = 10;
  const HEIGHT = 20;
  const TYPES = ["I", "J", "L", "O", "S", "T", "Z"];
  const COLORS = { I: "#5b9295", J: "#526b91", L: "#b87943", O: "#c2a648", S: "#6e9157", T: "#8a628d", Z: "#a85252" };
  const SHAPES = {
    I: [[0,1],[1,1],[2,1],[3,1]], J: [[0,0],[0,1],[1,1],[2,1]],
    L: [[2,0],[0,1],[1,1],[2,1]], O: [[1,0],[2,0],[1,1],[2,1]],
    S: [[1,0],[2,0],[0,1],[1,1]], T: [[1,0],[0,1],[1,1],[2,1]],
    Z: [[0,0],[1,0],[1,1],[2,1]]
  };
  // Guideline SRS wall kicks. These values use +Y upward;
  // rotate() converts them to the board's +Y-down coordinates.
  const JLSTZ_KICKS = {
    "0>1": [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    "1>0": [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    "1>2": [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    "2>1": [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    "2>3": [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    "3>2": [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    "3>0": [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    "0>3": [[0,0],[1,0],[1,1],[0,-2],[1,-2]]
  };
  const I_KICKS = {
    "0>1": [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    "1>0": [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    "1>2": [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    "2>1": [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    "2>3": [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    "3>2": [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    "3>0": [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    "0>3": [[0,0],[-1,0],[2,0],[-1,2],[2,-1]]
  };
  const $ = (selector) => document.querySelector(selector);
  const ui = {
    board: $("#block-board"), hold: $("#hold-piece"), next: $("#next-list"),
    score: $("#score-count"), lines: $("#line-count"), level: $("#level-count"),
    status: $("#blocks-status"), menu: $("#game-menu"), menuTitle: $("#menu-title"),
    menuKicker: $("#menu-kicker"), menuOptions: $("#menu-options")
  };
  const sound = (name) => window.PocketSound?.play(name);

  let board;
  let active;
  let queue;
  let held;
  let canHold;
  let score;
  let lines;
  let level;
  let state;
  let menuIndex;
  let lastTime;
  let fallElapsed;
  let groundedAt;
  let clearing = [];
  let clearTimer = 0;
  let sessionId = 0;

  function shuffledBag() {
    const bag = [...TYPES];
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  function fillQueue() {
    while (queue.length < 7) queue.push(...shuffledBag());
  }

  function cellsFor(piece, rotation = piece.rotation, x = piece.x, y = piece.y) {
    return SHAPES[piece.type].map(([baseX, baseY]) => {
      if (piece.type === "O") return [x + baseX, y + baseY];
      const [centerX, centerY] = piece.type === "I" ? [1.5, 1.5] : [1, 1];
      let px = baseX;
      let py = baseY;
      for (let turn = 0; turn < rotation; turn += 1) {
        [px, py] = [centerX - (py - centerY), centerY + (px - centerX)];
      }
      return [x + Math.round(px), y + Math.round(py)];
    });
  }

  function collides(piece, rotation = piece.rotation, x = piece.x, y = piece.y) {
    return cellsFor(piece, rotation, x, y).some(([cellX, cellY]) =>
      cellX < 0 || cellX >= WIDTH || cellY >= HEIGHT || (cellY >= 0 && board[cellY][cellX])
    );
  }

  function spawn(type = null) {
    fillQueue();
    active = { type: type || queue.shift(), rotation: 0, x: 3, y: -1 };
    fillQueue();
    groundedAt = 0;
    fallElapsed = 0;
    if (collides(active)) gameOver();
  }

  function gravityMs() {
    return Math.max(75, 800 * Math.pow(.82, level - 1));
  }

  function ghostY() {
    let y = active.y;
    while (!collides(active, active.rotation, active.x, y + 1)) y += 1;
    return y;
  }

  function move(dx, dy, soft = false) {
    if (state !== "playing" || collides(active, active.rotation, active.x + dx, active.y + dy)) return false;
    active.x += dx;
    active.y += dy;
    if (soft && dy > 0) score += 1;
    groundedAt = 0;
    if (dx) sound("move");
    render();
    return true;
  }

  function rotate(direction) {
    if (state !== "playing") return;
    const nextRotation = (active.rotation + direction + 4) % 4;
    if (active.type === "O") {
      active.rotation = nextRotation;
      groundedAt = 0;
      sound("flip");
      render();
      return;
    }
    const kickTable = active.type === "I" ? I_KICKS : JLSTZ_KICKS;
    const kicks = kickTable[`${active.rotation}>${nextRotation}`];
    const kick = kicks.find(([dx, srsY]) => !collides(active, nextRotation, active.x + dx, active.y - srsY));
    if (!kick) { sound("back"); return; }
    active.rotation = nextRotation;
    active.x += kick[0];
    active.y -= kick[1];
    groundedAt = 0;
    sound("flip");
    render();
  }

  function hardDrop() {
    if (state !== "playing") return;
    const destination = ghostY();
    score += Math.max(0, destination - active.y) * 2;
    active.y = destination;
    sound("slide");
    lockPiece();
  }

  function holdPiece() {
    if (state !== "playing" || !canHold) { if (state === "playing") sound("back"); return; }
    const previous = held;
    held = active.type;
    canHold = false;
    sound("hold");
    spawn(previous);
    render();
  }

  function lockPiece() {
    if (state !== "playing" || !active) return;
    state = "locking";
    let aboveTop = false;
    cellsFor(active).forEach(([x, y]) => {
      if (y < 0) aboveTop = true;
      else board[y][x] = active.type;
    });
    if (aboveTop) { gameOver(); return; }
    const fullRows = board.map((row, index) => row.every(Boolean) ? index : -1).filter((index) => index >= 0);
    if (fullRows.length) {
      clearing = fullRows;
      state = "clearing";
      active = null;
      sound(fullRows.length === 4 ? "win" : "pair");
      render();
      const expectedSession = sessionId;
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => {
        if (state === "clearing" && sessionId === expectedSession) clearLines(fullRows);
      }, 320);
      return;
    }
    canHold = true;
    state = "playing";
    spawn();
    render();
  }

  function clearLines(rows) {
    clearTimer = 0;
    const rowSet = new Set(rows);
    const remaining = board.filter((_, index) => !rowSet.has(index));
    board = [
      ...Array.from({ length: HEIGHT - remaining.length }, () => Array(WIDTH).fill(null)),
      ...remaining
    ];
    const rewards = [0, 100, 300, 500, 800];
    score += rewards[rows.length] * level;
    lines += rows.length;
    level = Math.floor(lines / 10) + 1;
    clearing = [];
    state = "playing";
    canHold = true;
    spawn();
    ui.status.textContent = `${rows.length} LINE CLEAR!`;
    render();
  }

  function miniBoard(type) {
    const element = document.createElement("div");
    element.className = "mini-board";
    const occupied = type ? new Set(SHAPES[type].map(([x, y]) => `${x},${y + (type === "I" ? 0 : 1)}`)) : new Set();
    for (let y = 0; y < 4; y += 1) for (let x = 0; x < 4; x += 1) {
      const cell = document.createElement("span");
      cell.className = "mini-cell";
      if (occupied.has(`${x},${y}`)) {
        cell.classList.add("is-filled");
        cell.style.setProperty("--piece-color", COLORS[type]);
      }
      element.append(cell);
    }
    return element;
  }

  function render() {
    const display = board.map((row) => [...row]);
    const classes = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => ""));
    if (active && ["playing", "locking", "paused"].includes(state)) {
      if (state === "playing") cellsFor(active, active.rotation, active.x, ghostY()).forEach(([x, y]) => {
        if (y >= 0 && !display[y][x]) classes[y][x] = "is-ghost";
      });
      cellsFor(active).forEach(([x, y]) => { if (y >= 0) display[y][x] = active.type; });
    }
    clearing.forEach((row) => classes[row].fill("is-clearing"));
    const fragment = document.createDocumentFragment();
    display.forEach((row, y) => row.forEach((type, x) => {
      const cell = document.createElement("span");
      cell.className = `block-cell ${classes[y][x]}`;
      if (type) {
        cell.classList.add("is-filled");
        cell.style.setProperty("--piece-color", COLORS[type]);
      }
      fragment.append(cell);
    }));
    ui.board.replaceChildren(fragment);
    ui.hold.replaceChildren(...miniBoard(held).childNodes);
    ui.next.replaceChildren(...queue.slice(0, 3).map(miniBoard));
    ui.score.textContent = String(score).padStart(6, "0");
    ui.lines.textContent = String(lines).padStart(3, "0");
    ui.level.textContent = String(level).padStart(2, "0");
  }

  function showMenu(kind = "pause") {
    state = kind === "gameover" ? "gameover" : "paused";
    menuIndex = 0;
    ui.menuKicker.textContent = kind === "gameover" ? "GAME OVER" : "PAUSE";
    ui.menuTitle.textContent = kind === "gameover" ? "ゲームオーバー" : "一時停止";
    const continueButton = ui.menuOptions.querySelector('[data-menu-action="continue"]');
    continueButton.hidden = kind === "gameover";
    menuIndex = kind === "gameover" ? 1 : 0;
    ui.menu.hidden = false;
    syncMenu();
  }

  function hideMenu() {
    ui.menu.hidden = true;
    state = "playing";
    lastTime = performance.now();
    groundedAt = 0;
    ui.status.textContent = "十字/A/Bをタップ、または対応キーで操作";
  }

  function menuButtons() { return [...ui.menuOptions.querySelectorAll("button:not([hidden])")]; }
  function syncMenu() {
    const buttons = menuButtons();
    menuIndex = Math.max(0, Math.min(menuIndex, buttons.length - 1));
    buttons.forEach((button, index) => button.classList.toggle("is-selected", index === menuIndex));
  }

  function moveMenu(step) {
    const buttons = menuButtons();
    menuIndex = (menuIndex + step + buttons.length) % buttons.length;
    sound("move");
    syncMenu();
  }

  function chooseMenu(action = menuButtons()[menuIndex]?.dataset.menuAction) {
    if (action === "continue") hideMenu();
    else if (action === "quit") window.location.href = "../../";
    else if (action === "reset") newGame();
    sound("confirm");
  }

  function gameOver() {
    sound("lose");
    ui.status.textContent = "GAME OVER";
    showMenu("gameover");
    render();
  }

  function newGame() {
    sessionId += 1;
    window.clearTimeout(clearTimer);
    clearTimer = 0;
    board = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null));
    queue = [];
    held = null;
    canHold = true;
    score = 0;
    lines = 0;
    level = 1;
    state = "playing";
    menuIndex = 0;
    lastTime = performance.now();
    fallElapsed = 0;
    groundedAt = 0;
    clearing = [];
    ui.menu.hidden = true;
    ui.menuOptions.querySelector('[data-menu-action="continue"]').hidden = false;
    ui.status.textContent = "十字/A/Bをタップ、または対応キーで操作";
    spawn();
    sound("start");
    render();
  }

  function tick(now) {
    const delta = Math.min(100, now - lastTime);
    lastTime = now;
    if (state === "playing") {
      fallElapsed += delta;
      if (fallElapsed >= gravityMs()) {
        fallElapsed = 0;
        if (!move(0, 1)) {
          if (!groundedAt) groundedAt = now;
          else if (now - groundedAt >= 450) lockPiece();
        }
      }
      if (state === "playing" && collides(active, active.rotation, active.x, active.y + 1)) {
        if (!groundedAt) groundedAt = now;
        else if (now - groundedAt >= 450) lockPiece();
      } else groundedAt = 0;
    }
    window.requestAnimationFrame(tick);
  }

  document.addEventListener("pocket-input", (event) => {
    const input = event.detail.action;
    if (["paused", "gameover"].includes(state)) {
      if (["up", "left"].includes(input)) moveMenu(-1);
      else if (["down", "right"].includes(input)) moveMenu(1);
      else if (input === "a") chooseMenu();
      else if (input === "b" && state === "paused") hideMenu();
      else if (input === "start" && state === "paused") hideMenu();
      return;
    }
    if (state !== "playing") return;
    if (input === "left") move(-1, 0);
    else if (input === "right") move(1, 0);
    else if (input === "down") move(0, 1, true);
    else if (input === "up") hardDrop();
    else if (input === "a") rotate(1);
    else if (input === "b") rotate(-1);
    else if (input === "select") holdPiece();
    else if (input === "start") { sound("back"); showMenu(); render(); }
  });

  document.addEventListener("keydown", (event) => {
    if (!event.repeat || state !== "playing") return;
    if (event.key === "ArrowLeft") move(-1, 0);
    else if (event.key === "ArrowRight") move(1, 0);
    else if (event.key === "ArrowDown") move(0, 1, true);
    else return;
    event.preventDefault();
  });

  ui.menuOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-menu-action]");
    if (button) chooseMenu(button.dataset.menuAction);
  });

  newGame();
  window.requestAnimationFrame((now) => { lastTime = now; window.requestAnimationFrame(tick); });
})();
