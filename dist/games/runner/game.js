(function () {
  "use strict";
  const canvas = document.querySelector("#game");
  const context = canvas.getContext("2d");
  const $ = (selector) => document.querySelector(selector);
  const sound = (name) => window.PocketSound?.play(name);
  const GROUND = 438;
  let runner, obstacles, clouds, score, state, spawnIn, groundOffset, lastTime;
  let highScore = Number(localStorage.getItem("pp-runner-hi") || 0);

  function reset() {
    runner = { x: 55, y: GROUND - 36, w: 28, h: 36, vy: 0, grounded: true };
    obstacles = [];
    clouds = [{ x: 90, y: 75 }, { x: 270, y: 130 }];
    score = 0;
    state = "ready";
    spawnIn = 1.15;
    groundOffset = 0;
    sync();
    $("#status").textContent = "画面をタップ、またはA/上でジャンプ";
  }

  function speed() { return Math.min(390, 205 + score * .32); }

  function sync() {
    $("#score").textContent = String(Math.floor(score)).padStart(5, "0");
    $("#high").textContent = `HI ${String(Math.floor(highScore)).padStart(5, "0")}`;
    $("#speed").textContent = `SPEED ${(speed() / 205).toFixed(1)}`;
  }

  function jump() {
    if (state === "over") { reset(); state = "playing"; }
    if (state === "ready") state = "playing";
    if (state !== "playing" || !runner.grounded) return;
    runner.vy = -610;
    runner.grounded = false;
    $("#status").textContent = "画面をタップ、またはA/上でジャンプ";
    sound("slide");
  }

  function addObstacle() {
    const tall = Math.random() < .42;
    const width = tall ? 22 : 31;
    const height = tall ? 54 : 31;
    obstacles.push({ x: 380, y: GROUND - height, w: width, h: height, passed: false });
    spawnIn = Math.max(.82, 1.22 + Math.random() * .72 - score / 900);
  }

  function overlaps(a, b) {
    return a.x + 5 < b.x + b.w && a.x + a.w - 4 > b.x && a.y + 4 < b.y + b.h && a.y + a.h > b.y + 3;
  }

  function update(deltaMs) {
    if (state !== "playing") return;
    const delta = deltaMs / 1000;
    score += delta * 10;
    const move = speed() * delta;
    groundOffset = (groundOffset + move) % 24;
    runner.vy += 1620 * delta;
    runner.y += runner.vy * delta;
    if (runner.y >= GROUND - runner.h) {
      runner.y = GROUND - runner.h;
      runner.vy = 0;
      runner.grounded = true;
    }
    spawnIn -= delta;
    if (spawnIn <= 0) addObstacle();
    obstacles.forEach((obstacle) => {
      obstacle.x -= move;
      if (!obstacle.passed && obstacle.x + obstacle.w < runner.x) {
        obstacle.passed = true;
        score += 5;
        sound("tick");
      }
    });
    obstacles = obstacles.filter((obstacle) => obstacle.x > -50);
    clouds.forEach((cloud) => {
      cloud.x -= move * .12;
      if (cloud.x < -45) { cloud.x = 380; cloud.y = 65 + Math.random() * 105; }
    });
    if (obstacles.some((obstacle) => overlaps(runner, obstacle))) {
      state = "over";
      highScore = Math.max(highScore, Math.floor(score));
      localStorage.setItem("pp-runner-hi", highScore);
      $("#status").textContent = "CRASH! 画面をタップ、またはAで再挑戦";
      sound("lose");
    }
    highScore = Math.max(highScore, Math.floor(score));
    sync();
  }

  function drawRunner() {
    context.fillStyle = "#253927";
    context.fillRect(runner.x + 5, runner.y, 18, 18);
    context.fillRect(runner.x, runner.y + 15, 25, 13);
    context.fillRect(runner.x + 19, runner.y + 5, 9, 5);
    const stride = state === "playing" && runner.grounded && Math.floor(performance.now() / 100) % 2;
    context.fillRect(runner.x + (stride ? 4 : 15), runner.y + 27, 5, 9);
    context.clearRect(runner.x + 17, runner.y + 4, 3, 3);
  }

  function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(82,111,78,.38)";
    clouds.forEach((cloud) => {
      context.fillRect(cloud.x, cloud.y, 34, 7);
      context.fillRect(cloud.x + 9, cloud.y - 7, 17, 7);
    });
    context.strokeStyle = "#253927";
    context.lineWidth = 3;
    context.beginPath(); context.moveTo(0, GROUND + 1); context.lineTo(360, GROUND + 1); context.stroke();
    context.fillStyle = "#526f4e";
    for (let x = -groundOffset; x < 370; x += 24) context.fillRect(x, GROUND + 12, 13, 3);
    obstacles.forEach((obstacle) => {
      context.fillStyle = "#253927";
      context.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
      context.fillStyle = "#91aa78";
      context.fillRect(obstacle.x + 5, obstacle.y + 7, 4, 4);
    });
    drawRunner();
    if (state === "ready" || state === "paused") {
      context.fillStyle = "rgba(37,57,39,.86)";
      context.fillRect(56, 202, 248, 72);
      context.fillStyle = "#c7dfa0";
      context.textAlign = "center";
      context.font = "bold 20px monospace";
      context.fillText(state === "paused" ? "PAUSE" : "JUMP TO START", 180, 245);
    }
  }

  function loop(time) {
    const delta = Math.min(35, time - lastTime || 0);
    lastTime = time;
    update(delta);
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", (event) => { event.preventDefault(); jump(); });
  document.addEventListener("pocket-input", (event) => {
    const action = event.detail.action;
    if (["a", "up"].includes(action)) jump();
    else if (action === "start") {
      if (state === "over") reset();
      else if (state === "ready") state = "playing";
      else if (state === "playing") state = "paused";
      else if (state === "paused") state = "playing";
    } else if (action === "select") document.querySelector("[data-sound-toggle]")?.click();
    else if (action === "b") location.href = "../../";
  });
  reset();
  requestAnimationFrame(loop);
})();
