(function () {
  "use strict";

  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const TIMING = { deal: 1200, inspect: 650, message: 850, pick: 520, reveal: 850, pair: 800, cpuThink: 1100, turnChange: 700, shuffleMid: 380, shuffleEnd: 780 };
  const $ = (selector) => document.querySelector(selector);
  const sound = (name) => window.PocketSound?.play(name);
  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  const ui = {
    cpuHand: $("#cpu-hand"), playerHand: $("#player-hand"), cpuCount: $("#cpu-count"), playerCount: $("#player-count"),
    status: $("#status-message"), turn: $("#turn-label"), discard: $("#discard-pile"), draw: $("#draw-button"),
    result: $("#result-panel"), resultTitle: $("#result-title"), resultCopy: $("#result-copy"),
    replay: $("#replay-button"), rules: $("#rules-button"), rulesPanel: $("#rules-panel")
  };

  let player = [];
  let cpu = [];
  let turn = "idle";
  let discardedPairs = 0;
  let actionToken = 0;
  let highlightedCardId = null;
  let newCardId = null;
  let pairingIds = [];
  let dealing = false;
  let shuffling = false;
  let cpuSelection = 0;

  function makeDeck() {
    const cards = [];
    SUITS.forEach((suit) => RANKS.forEach((rank) => cards.push({ id: `${suit}${rank}`, suit, rank, joker: false })));
    cards.push({ id: "joker", suit: "★", rank: "JOKER", joker: true });
    return cards;
  }

  function shuffle(cards) {
    for (let i = cards.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  function pairedCardIds(hand) {
    const byRank = new Map();
    hand.forEach((card) => {
      if (card.joker) return;
      if (!byRank.has(card.rank)) byRank.set(card.rank, []);
      byRank.get(card.rank).push(card);
    });
    const ids = [];
    byRank.forEach((cards) => cards.slice(0, Math.floor(cards.length / 2) * 2).forEach((card) => ids.push(card.id)));
    return ids;
  }

  function discardCards(hand, ids) {
    const removed = new Set(ids);
    discardedPairs += ids.length / 2;
    return hand.filter((card) => !removed.has(card.id));
  }

  function pairForDraw(hand, drawnCard) {
    if (drawnCard.joker) return [];
    return hand.filter((card) => card.rank === drawnCard.rank).slice(0, 2).map((card) => card.id);
  }

  function cardLabel(card) { return card.joker ? "JOKER" : `${card.rank}${card.suit}`; }

  function makePlayerCard(card, index) {
    const el = document.createElement("div");
    el.className = `card${card.joker ? " card--joker" : ["♥", "♦"].includes(card.suit) ? " card--red" : ""}`;
    el.dataset.cardId = card.id;
    el.setAttribute("aria-label", cardLabel(card));
    el.style.setProperty("--deal-delay", `${Math.min(index * 28, 560)}ms`);
    if (dealing) el.classList.add("is-dealing");
    if (highlightedCardId === card.id) el.classList.add("is-picked");
    if (newCardId === card.id) el.classList.add("is-new");
    if (pairingIds.includes(card.id)) el.classList.add("is-pairing");
    el.innerHTML = card.joker
      ? "<span class=\"card__joker\">[JOKER]</span>"
      : `<span class="card__rank">${card.rank}</span><span class="card__suit">${card.suit}</span>`;
    return el;
  }

  function makeCpuCard(card, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card card--back";
    button.setAttribute("aria-label", `CPUのカード ${index + 1}枚目を引く`);
    button.style.setProperty("--deal-delay", `${Math.min(index * 28, 560)}ms`);
    button.style.setProperty("--shuffle-delay", `${(index % 5) * 18}ms`);
    button.style.setProperty("--shuffle-x", `${index % 2 ? -34 : 34}px`);
    button.style.setProperty("--shuffle-r", `${index % 2 ? -9 : 9}deg`);
    if (dealing) button.classList.add("is-dealing");
    if (highlightedCardId === card.id) button.classList.add("is-picked");
    if (newCardId === card.id) button.classList.add("is-new");
    if (pairingIds.includes(card.id)) button.classList.add("is-pairing");
    if (turn === "player" && index === cpuSelection) button.classList.add("is-selected");
    button.disabled = turn !== "player";
    button.addEventListener("click", () => { cpuSelection = index; playerDraw(index); });
    return button;
  }

  function render() {
    ui.playerHand.replaceChildren(...player.map(makePlayerCard));
    ui.cpuHand.replaceChildren(...cpu.map(makeCpuCard));
    ui.playerHand.classList.toggle("is-compact", player.length > 14);
    ui.cpuHand.classList.toggle("is-compact", cpu.length > 14);
    ui.cpuHand.classList.toggle("is-shuffling", shuffling);
    ui.playerCount.textContent = `${player.length}枚`;
    ui.cpuCount.textContent = `${cpu.length}枚`;
    ui.draw.disabled = turn !== "player" || cpu.length === 0;
    ui.discard.classList.toggle("has-pair", discardedPairs > 0);
    ui.discard.setAttribute("aria-label", `捨て札 ${discardedPairs}ペア`);
  }

  function setStatus(message, label) {
    ui.status.textContent = message;
    ui.turn.textContent = label;
    ui.status.classList.remove("is-changing");
    void ui.status.offsetWidth;
    ui.status.classList.add("is-changing");
  }

  function pulseDiscard() {
    ui.discard.classList.remove("is-receiving");
    void ui.discard.offsetWidth;
    ui.discard.classList.add("is-receiving");
  }

  function resetAnimationState() {
    highlightedCardId = null;
    newCardId = null;
    pairingIds = [];
    dealing = false;
    shuffling = false;
  }

  async function shuffleCpuHand(token) {
    if (cpu.length < 2 || token !== actionToken) return;
    turn = "busy";
    shuffling = true;
    setStatus("CPUの手札をシャッフル中…", "SHUFFLE");
    sound("shuffle");
    render();
    await wait(TIMING.shuffleMid);
    if (token !== actionToken) return;
    shuffle(cpu);
    cpuSelection = 0;
    render();
    await wait(TIMING.shuffleEnd);
    if (token !== actionToken) return;
    shuffling = false;
    render();
    setStatus("シャッフル完了", "READY");
    await wait(420);
  }

  async function startGame() {
    actionToken += 1;
    const token = actionToken;
    const deck = shuffle(makeDeck());
    player = [];
    cpu = [];
    discardedPairs = 0;
    turn = "idle";
    cpuSelection = 0;
    resetAnimationState();
    dealing = true;
    ui.result.hidden = true;
    deck.forEach((card, index) => (index % 2 === 0 ? player : cpu).push(card));
    setStatus("カードを配っています…", "DEALING");
    sound("start");
    render();
    await wait(TIMING.deal);
    if (token !== actionToken) return;

    dealing = false;
    setStatus("手札のペアを探しています…", "PAIR CHECK");
    render();
    await wait(TIMING.inspect);
    if (token !== actionToken) return;

    const playerPairs = pairedCardIds(player);
    const cpuPairs = pairedCardIds(cpu);
    pairingIds = [...playerPairs, ...cpuPairs];
    setStatus(`最初のペアが${pairingIds.length / 2}組ありました`, "PAIR!");
    sound("pair");
    render();
    await wait(TIMING.pair);
    if (token !== actionToken) return;

    player = discardCards(player, playerPairs);
    cpu = discardCards(cpu, cpuPairs);
    pairingIds = [];
    render();
    pulseDiscard();
    sound("discard");
    setStatus(`${discardedPairs}組を捨て札へ`, "DISCARD");
    await wait(TIMING.message);
    if (token !== actionToken || finishIfNeeded()) return;
    await shuffleCpuHand(token);
    if (token !== actionToken) return;
    beginPlayerTurn();
  }

  function beginPlayerTurn() {
    turn = "player";
    cpuSelection = Math.min(cpuSelection, Math.max(cpu.length - 1, 0));
    setStatus("カードをタップ、または十字＋Aで引こう", "YOUR TURN");
    render();
  }

  async function playerDraw(index) {
    if (turn !== "player" || !cpu[index]) return;
    const token = actionToken;
    turn = "busy";
    const card = cpu[index];
    highlightedCardId = card.id;
    setStatus("このカードを引きます…", "DRAW");
    sound("draw");
    render();
    await wait(TIMING.pick);
    if (token !== actionToken) return;

    cpu.splice(index, 1);
    player.push(card);
    highlightedCardId = null;
    newCardId = card.id;
    setStatus(`${cardLabel(card)}を引きました`, "OPEN");
    render();
    await wait(TIMING.reveal);
    if (token !== actionToken) return;

    newCardId = null;
    const pair = pairForDraw(player, card);
    if (pair.length) {
      pairingIds = pair;
      setStatus(`${cardLabel(card)}でペア！`, "PAIR!");
      sound("pair");
      render();
      await wait(TIMING.pair);
      if (token !== actionToken) return;
      player = discardCards(player, pair);
      pairingIds = [];
      render();
      pulseDiscard();
      sound("discard");
      setStatus("ペアを捨て札へ", "DISCARD");
      await wait(TIMING.message);
    } else {
      setStatus("ペアはできませんでした", "NO PAIR");
      render();
      await wait(TIMING.message);
    }
    if (token !== actionToken || finishIfNeeded()) return;
    setStatus("次はCPUの番です", "TURN CHANGE");
    await wait(TIMING.turnChange);
    if (token !== actionToken) return;
    await cpuDraw(token);
  }

  async function cpuDraw(token) {
    if (token !== actionToken || turn === "finished") return;
    turn = "cpu";
    setStatus("CPUがカードを選んでいます…", "CPU THINK");
    render();
    await wait(TIMING.cpuThink);
    if (token !== actionToken || turn === "finished") return;

    const index = Math.floor(Math.random() * player.length);
    const card = player[index];
    highlightedCardId = card.id;
    setStatus("CPUが1枚選びました", "CPU DRAW");
    sound("draw");
    render();
    await wait(TIMING.pick);
    if (token !== actionToken) return;

    player.splice(index, 1);
    cpu.push(card);
    highlightedCardId = null;
    newCardId = card.id;
    setStatus(`CPUは${cardLabel(card)}を引きました`, "OPEN");
    render();
    await wait(TIMING.reveal);
    if (token !== actionToken) return;

    newCardId = null;
    const pair = pairForDraw(cpu, card);
    if (pair.length) {
      pairingIds = pair;
      setStatus("CPUにもペアができました", "CPU PAIR!");
      sound("pair");
      render();
      await wait(TIMING.pair);
      if (token !== actionToken) return;
      cpu = discardCards(cpu, pair);
      pairingIds = [];
      render();
      pulseDiscard();
      sound("discard");
      setStatus("CPUがペアを捨てました", "DISCARD");
      await wait(TIMING.message);
    } else {
      setStatus("CPUにもペアはできませんでした", "NO PAIR");
      render();
      await wait(TIMING.message);
    }
    if (token !== actionToken || finishIfNeeded()) return;

    await shuffleCpuHand(token);
    if (token !== actionToken) return;
    setStatus("あなたの番に戻ります", "TURN CHANGE");
    await wait(TIMING.turnChange);
    if (token !== actionToken) return;
    beginPlayerTurn();
  }

  function finishIfNeeded() {
    if (player.length && cpu.length) return false;
    turn = "finished";
    resetAnimationState();
    const playerWon = player.length === 0;
    setStatus(playerWon ? "ジョーカーをCPUに残した！" : "ジョーカーが手元に残った…", "GAME SET");
    ui.resultTitle.textContent = playerWon ? "YOU WIN!" : "YOU LOSE";
    ui.resultCopy.textContent = playerWon ? "お見事。先に手札をなくしました。" : "残念！もう一度なら勝てるかも。";
    ui.result.hidden = false;
    render();
    sound(playerWon ? "win" : "lose");
    ui.replay.focus();
    return true;
  }

  function toggleRules() {
    const willOpen = ui.rulesPanel.hidden;
    ui.rulesPanel.hidden = !willOpen;
    ui.rules.setAttribute("aria-expanded", String(willOpen));
    sound(willOpen ? "confirm" : "back");
  }

  function moveCpuSelection(step) {
    if (turn !== "player" || !cpu.length) return;
    cpuSelection = (cpuSelection + step + cpu.length) % cpu.length;
    sound("move");
    render();
  }

  ui.replay.addEventListener("click", startGame);
  ui.rules.addEventListener("click", toggleRules);
  document.addEventListener("pocket-reset", startGame);
  document.addEventListener("pocket-input", (event) => {
    const action = event.detail.action;
    if (["left", "up"].includes(action)) moveCpuSelection(-1);
    else if (["right", "down"].includes(action)) moveCpuSelection(1);
    else if (action === "a" && turn === "player") playerDraw(cpuSelection);
    else if (["b", "start"].includes(action)) toggleRules();
    else if (action === "select") document.querySelector("[data-sound-toggle]")?.click();
  });

  startGame();
})();
