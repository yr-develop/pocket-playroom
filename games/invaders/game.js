(function () {
  "use strict";

  const canvas = document.querySelector("#game");
  const context = canvas.getContext("2d");
  const $ = (selector) => document.querySelector(selector);
  const sound = (name) => window.PocketSound?.play(name);
  const keys = { left: false, right: false };
  let player, aliens, shields, shots, enemyShots;
  let score = 0, lives = 3, wave = 1, state = "playing", direction = 1;
  let lastTime = 0, shotCooldown = 0, invulnerable = 0;
  let highScore = Number(localStorage.getItem("pp-invaders-hi") || 0);

  function makeShields() {
    const blocks = [];
    [46, 126, 206, 286].forEach((baseX) => {
      for (let row = 0; row < 4; row += 1) for (let col = 0; col < 7; col += 1) {
        const topCorner = row === 0 && (col === 0 || col === 6);
        const lowerGap = row >= 2 && [2, 3, 4].includes(col);
        if (!topCorner && !lowerGap) blocks.push({ x: baseX + col * 6, y: 390 + row * 6, w: 6, h: 6, hp: 2 });
      }
    });
    return blocks;
  }

  function resetWave() {
    player = { x: 164, y: 465, w: 30, h: 12 };
    shots = [];
    enemyShots = [];
    shields = makeShields();
    aliens = [];
    for (let row = 0; row < 4; row += 1) for (let col = 0; col < 8; col += 1) {
      aliens.push({ x: 28 + col * 40, y: 55 + row * 34, w: 22, h: 15, alive: true });
    }
    direction = 1;
    invulnerable = 700;
    state = "playing";
    sync();
  }

  function sync() {
    $("#score").textContent = String(score).padStart(6, "0");
    $("#wave").textContent = `WAVE ${String(wave).padStart(2, "0")}`;
    $("#lives").textContent = `LIFE ${"♥".repeat(lives)}`;
    $("#high").textContent = `HI ${String(highScore).padStart(6, "0")}`;
  }

  function fire() {
    if (state !== "playing" || shotCooldown) return;
    shots.push({ x: player.x + 14, y: player.y - 7, w: 3, h: 8 });
    shotCooldown = 260;
    sound("tick");
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function damageShield(projectile) {
    const block = shields.find((item) => item.hp > 0 && overlaps(projectile, item));
    if (!block) return false;
    block.hp -= 1;
    projectile.dead = true;
    sound("discard");
    return true;
  }

  function loseLife() {
    if (invulnerable > 0) return;
    lives -= 1;
    sound("lose");
    enemyShots = [];
    player.x = 164;
    invulnerable = 1200;
    if (lives <= 0) {
      state = "over";
      $("#status").textContent = "GAME OVER — STARTをタップ、またはSで再開";
    }
  }

  function update(delta) {
    if (state !== "playing") return;
    if (keys.left) player.x -= delta * .18;
    if (keys.right) player.x += delta * .18;
    player.x = Math.max(2, Math.min(328, player.x));
    shotCooldown = Math.max(0, shotCooldown - delta);
    invulnerable = Math.max(0, invulnerable - delta);
    shots.forEach((shot) => { shot.y -= delta * .3; });
    enemyShots.forEach((shot) => { shot.y += delta * .18; });

    const alive = aliens.filter((alien) => alien.alive);
    const shift = direction * delta * (.018 + wave * .003);
    alive.forEach((alien) => { alien.x += shift; });
    if (alive.length) {
      const left = Math.min(...alive.map((alien) => alien.x));
      const right = Math.max(...alive.map((alien) => alien.x + alien.w));
      if (left < 5 || right > 355) {
        const correction = left < 5 ? 5 - left : 355 - right;
        alive.forEach((alien) => { alien.x += correction; alien.y += 10; });
        direction *= -1;
      }
    }

    if (Math.random() < delta * (.00022 + wave * .00003) && alive.length) {
      const alien = alive[Math.floor(Math.random() * alive.length)];
      enemyShots.push({ x: alien.x + 10, y: alien.y + 15, w: 3, h: 8 });
    }

    shots.forEach((shot) => {
      if (damageShield(shot)) return;
      const alien = alive.find((target) => target.alive && overlaps(shot, target));
      if (!alien) return;
      alien.alive = false;
      shot.dead = true;
      score += 10 * wave;
      sound("pair");
    });
    enemyShots.forEach((shot) => {
      if (damageShield(shot)) return;
      if (invulnerable <= 0 && overlaps(shot, player)) { shot.dead = true; loseLife(); }
    });
    alive.forEach((alien) => {
      shields.forEach((block) => { if (block.hp && overlaps(alien, block)) block.hp = 0; });
    });
    shots = shots.filter((shot) => !shot.dead && shot.y > -10);
    enemyShots = enemyShots.filter((shot) => !shot.dead && shot.y < 510);

    if (alive.some((alien) => alien.alive && alien.y + alien.h >= player.y - 4)) {
      lives = 0;
      sound("lose");
      state = "over";
      $("#status").textContent = "INVASION! — STARTをタップ、またはSで再開";
    }
    if (!aliens.some((alien) => alien.alive)) {
      wave += 1;
      score += 100;
      sound("win");
      resetWave();
    }
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("pp-invaders-hi", highScore);
    }
    sync();
  }

  function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    shields.forEach((block) => {
      if (!block.hp) return;
      context.fillStyle = block.hp === 2 ? "#526f4e" : "#829c6a";
      context.fillRect(block.x, block.y, block.w, block.h);
    });
    if (invulnerable <= 0 || Math.floor(invulnerable / 100) % 2 === 0) {
      context.fillStyle = "#253927";
      context.fillRect(player.x, player.y, player.w, player.h);
      context.fillRect(player.x + 11, player.y - 6, 8, 6);
    }
    aliens.filter((alien) => alien.alive).forEach((alien, index) => {
      context.fillStyle = index % 2 ? "#526f4e" : "#253927";
      context.fillRect(alien.x, alien.y, alien.w, alien.h);
      context.clearRect(alien.x + 4, alien.y + 4, 4, 4);
      context.clearRect(alien.x + 14, alien.y + 4, 4, 4);
    });
    context.fillStyle = "#253927";
    shots.forEach((shot) => context.fillRect(shot.x, shot.y, shot.w, shot.h));
    context.fillStyle = "#8f3340";
    enemyShots.forEach((shot) => context.fillRect(shot.x, shot.y, shot.w, shot.h));
    if (state === "paused") {
      context.fillStyle = "rgba(37,57,39,.85)";
      context.fillRect(70, 210, 220, 65);
      context.fillStyle = "#c7dfa0";
      context.font = "bold 22px monospace";
      context.fillText("PAUSE", 145, 250);
    }
  }

  function loop(time) {
    const delta = Math.min(40, time - lastTime || 0);
    lastTime = time;
    update(delta);
    draw();
    requestAnimationFrame(loop);
  }

  document.addEventListener("pocket-input", (event) => {
    const action = event.detail.action;
    if (action === "left") player.x -= 10;
    else if (action === "right") player.x += 10;
    else if (action === "a") fire();
    else if (action === "start") {
      if (state === "over") { score = 0; lives = 3; wave = 1; resetWave(); }
      else {
        state = state === "paused" ? "playing" : "paused";
        $("#status").textContent = state === "paused" ? "PAUSE — STARTをタップ、またはSで再開" : "十字をタップ/矢印キーで移動・Aをタップ/EnterでSHOT";
      }
    } else if (action === "b") location.href = "../../";
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") keys.left = true;
    if (event.key === "ArrowRight") keys.right = true;
  });
  document.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft") keys.left = false;
    if (event.key === "ArrowRight") keys.right = false;
  });
  document.addEventListener("pocket-input-start", (event) => {
    if (event.detail.source === "keyboard") return;
    if (event.detail.action === "left") keys.left = true;
    if (event.detail.action === "right") keys.right = true;
  });
  document.addEventListener("pocket-input-end", (event) => {
    if (event.detail.source === "keyboard") return;
    if (event.detail.action === "left") keys.left = false;
    if (event.detail.action === "right") keys.right = false;
  });
  resetWave();
  requestAnimationFrame(loop);
})();
