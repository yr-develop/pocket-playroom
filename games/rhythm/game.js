(function () {
  "use strict";
  const canvas = document.querySelector("#game");
  const context = canvas.getContext("2d");
  const $ = (selector) => document.querySelector(selector);
  const sound = (name) => window.PocketSound?.play(name);
  const LANES = ["left", "down", "up", "right", "b", "a"];
  const SYMBOLS = { left: "←", down: "↓", up: "↑", right: "→", b: "B", a: "A" };
  const TRAVEL = 2100;
  const TARGET_Y = 430;
  let notes = [], state = "ready", score = 0, combo = 0, maxCombo = 0;
  let songStart = 0, pauseStarted = 0, lastTime = 0, nextBeat = 0;
  let best = Number(localStorage.getItem("pp-rhythm-best") || 0);

  function buildChart() {
    const pattern = ["left","right","a","down","up","b","left","a","right","b","up","down","a","left","b","right"];
    const chart = [];
    for (let index = 0; index < 56; index += 1) {
      chart.push({ action: pattern[(index * 5 + Math.floor(index / 8) * 3) % pattern.length], time: 2400 + index * 570, hit: false, missed: false });
    }
    return chart;
  }

  function sync() {
    $("#score").textContent = String(score).padStart(6, "0");
    $("#combo").textContent = `COMBO ${String(combo).padStart(3, "0")}`;
    $("#best").textContent = `BEST ${String(best).padStart(6, "0")}`;
  }

  function showJudge(label) {
    const element = $("#judgement");
    element.textContent = label;
    element.className = `judgement ${label === "NICE!" ? "nice" : label === "BAD" ? "bad" : ""}`;
    void element.offsetWidth;
    element.classList.add("show");
  }

  function startSong() {
    notes = buildChart();
    score = 0;
    combo = 0;
    maxCombo = 0;
    nextBeat = 0;
    songStart = performance.now();
    state = "playing";
    $("#status").textContent = "画面の対応ボタンをタップ、または対応キーを押そう";
    showJudge("GO!");
    sound("start");
    sync();
  }

  function songTime(now = performance.now()) { return now - songStart; }

  function grade(error) {
    if (error <= 65) return { label: "NICE!", points: 1000, sound: "coin" };
    if (error <= 125) return { label: "GOOD", points: 700, sound: "pair" };
    if (error <= 205) return { label: "OK", points: 400, sound: "confirm" };
    return { label: "BAD", points: 100, sound: "back" };
  }

  function judge(action) {
    if (state === "ready" || state === "over") { startSong(); return; }
    if (state !== "playing") return;
    const now = songTime();
    const candidate = notes
      .filter((note) => !note.hit && !note.missed && note.action === action)
      .sort((a, b) => Math.abs(a.time - now) - Math.abs(b.time - now))[0];
    const error = candidate ? Math.abs(candidate.time - now) : Infinity;
    if (!candidate || error > 300) {
      combo = 0;
      showJudge("BAD");
      sound("back");
      sync();
      return;
    }
    candidate.hit = true;
    const result = grade(error);
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    score += result.points + Math.min(combo, 50) * 10;
    showJudge(result.label);
    sound(result.sound);
    sync();
  }

  function finish() {
    state = "over";
    best = Math.max(best, score);
    localStorage.setItem("pp-rhythm-best", best);
    $("#status").textContent = `FINISH! MAX COMBO ${maxCombo} — STARTをタップ、またはSで再演奏`;
    showJudge("FINISH!");
    sound("win");
    sync();
  }

  function update(time) {
    if (state !== "playing") return;
    const now = songTime(time);
    while (now >= nextBeat) {
      if (nextBeat > 0) sound("tick");
      nextBeat += 570;
    }
    notes.forEach((note) => {
      if (!note.hit && !note.missed && now > note.time + 300) {
        note.missed = true;
        combo = 0;
        showJudge("BAD");
      }
    });
    const lastNote = notes[notes.length - 1];
    if (lastNote && now > lastNote.time + 900) finish();
    sync();
  }

  function drawNote(note, now) {
    if (note.hit || note.missed) return;
    const lane = LANES.indexOf(note.action);
    const y = TARGET_Y - ((note.time - now) / TRAVEL) * 470;
    if (y < -35 || y > 485) return;
    const x = lane * 60 + 30;
    context.fillStyle = note.action === "a" || note.action === "b" ? "#8f3340" : "#253927";
    context.beginPath(); context.arc(x, y, 20, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#c7dfa0";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "bold 21px monospace";
    context.fillText(SYMBOLS[note.action], x, y + 1);
  }

  function draw(time) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let lane = 0; lane < 6; lane += 1) {
      context.fillStyle = lane % 2 ? "rgba(82,111,78,.10)" : "rgba(37,57,39,.05)";
      context.fillRect(lane * 60, 0, 60, 500);
      context.strokeStyle = "rgba(37,57,39,.22)";
      context.strokeRect(lane * 60, 0, 60, 500);
    }
    context.fillStyle = "#526f4e";
    context.fillRect(0, TARGET_Y - 3, 360, 6);
    LANES.forEach((action, lane) => {
      const x = lane * 60 + 30;
      context.strokeStyle = "#253927";
      context.lineWidth = 3;
      context.beginPath(); context.arc(x, TARGET_Y, 23, 0, Math.PI * 2); context.stroke();
      context.fillStyle = "#253927";
      context.textAlign = "center"; context.textBaseline = "middle"; context.font = "bold 19px monospace";
      context.fillText(SYMBOLS[action], x, TARGET_Y + 1);
    });
    const now = state === "playing" ? songTime(time) : state === "paused" ? songTime(pauseStarted) : 0;
    notes.forEach((note) => drawNote(note, now));
    if (["ready", "paused", "over"].includes(state)) {
      context.fillStyle = "rgba(37,57,39,.86)";
      context.fillRect(55, 185, 250, 72);
      context.fillStyle = "#c7dfa0";
      context.textAlign = "center";
      context.font = "bold 20px monospace";
      context.fillText(state === "paused" ? "PAUSE" : state === "over" ? "SONG CLEAR" : "PRESS START", 180, 228);
    }
  }

  function loop(time) {
    lastTime = time;
    update(time);
    draw(time);
    requestAnimationFrame(loop);
  }

  document.addEventListener("pocket-input", (event) => {
    const action = event.detail.action;
    if (LANES.includes(action)) judge(action);
    else if (action === "start") {
      if (state === "ready" || state === "over") startSong();
      else if (state === "playing") { state = "paused"; pauseStarted = performance.now(); $("#status").textContent = "PAUSE — STARTをタップ、またはSで再開"; }
      else if (state === "paused") { songStart += performance.now() - pauseStarted; state = "playing"; $("#status").textContent = "画面の対応ボタンをタップ、または対応キーを押そう"; }
    } else if (action === "select") document.querySelector("[data-sound-toggle]")?.click();
  });
  notes = buildChart();
  sync();
  requestAnimationFrame(loop);
})();
