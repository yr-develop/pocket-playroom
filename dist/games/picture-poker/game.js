(function () {
  "use strict";

  const SYMBOLS = [
    { id: "sun", symbol: "☀", name: "SUN", color: "#b47317", strength: 5 },
    { id: "star", symbol: "★", name: "STAR", color: "#9a3c45", strength: 4 },
    { id: "heart", symbol: "♥", name: "HEART", color: "#bd3f4a", strength: 3 },
    { id: "seven", symbol: "7", name: "SEVEN", color: "#315a83", strength: 2 },
    { id: "berry", symbol: "●", name: "BERRY", color: "#68427d", strength: 1 }
  ];
  const HANDS = [
    { name: "5 MATCH", rank: 6, multiplier: 20, test: (counts) => counts[0] === 5 },
    { name: "4 MATCH", rank: 5, multiplier: 8, test: (counts) => counts[0] === 4 },
    { name: "FULL HOUSE", rank: 4, multiplier: 5, test: (counts) => counts[0] === 3 && counts[1] === 2 },
    { name: "3 MATCH", rank: 3, multiplier: 3, test: (counts) => counts[0] === 3 },
    { name: "2 PAIR", rank: 2, multiplier: 2, test: (counts) => counts[0] === 2 && counts[1] === 2 },
    { name: "1 PAIR", rank: 1, multiplier: 1, test: (counts) => counts[0] === 2 }
  ];
  const $ = (selector) => document.querySelector(selector);
  const sound = (name) => window.PocketSound?.play(name);
  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  const ui = {
    hand: $("#poker-hand"), cpuHand: $("#cpu-hand"), status: $("#poker-status"),
    action: $("#poker-action"), start: $("#start-control"), coins: $("#coin-count"),
    bet: $("#bet-count"), betDown: $("#bet-down"), betUp: $("#bet-up"),
    round: $("#round-count"), mode: $("#poker-mode")
  };

  let coins = 20;
  let bet = 1;
  let round = 0;
  let deck = [];
  let hand = [];
  let cpuHand = [];
  let changes = [false, false, false, false, false];
  let selected = 0;
  let phase = "idle";
  let animating = false;
  let dealingAnimation = false;
  let replacingOwner = "";
  let replacingIndex = -1;
  let gameToken = 0;

  function makeDeck() {
    return SYMBOLS.flatMap((symbol) => Array.from({ length: 5 }, (_, copy) => ({ ...symbol, key: `${symbol.id}-${copy}` })));
  }

  function shuffle(cards) {
    for (let i = cards.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  function frequencies(cards) {
    const map = new Map();
    cards.forEach((card) => map.set(card.id, (map.get(card.id) || 0) + 1));
    return map;
  }

  function evaluate(cards) {
    const groups = [...frequencies(cards).entries()]
      .map(([id, count]) => ({ id, count, strength: SYMBOLS.find((symbol) => symbol.id === id).strength }))
      .sort((a, b) => b.count - a.count || b.strength - a.strength);
    const counts = groups.map((group) => group.count);
    const handResult = HANDS.find((item) => item.test(counts)) || { name: "NO MATCH", rank: 0, multiplier: 0 };
    return { ...handResult, tie: groups.flatMap((group) => [group.count, group.strength]) };
  }

  function compareHands(playerCards, cpuCards) {
    const player = evaluate(playerCards);
    const cpu = evaluate(cpuCards);
    if (player.rank !== cpu.rank) return { outcome: player.rank > cpu.rank ? 1 : -1, player, cpu };
    const length = Math.max(player.tie.length, cpu.tie.length);
    for (let i = 0; i < length; i += 1) {
      if ((player.tie[i] || 0) !== (cpu.tie[i] || 0)) {
        return { outcome: (player.tie[i] || 0) > (cpu.tie[i] || 0) ? 1 : -1, player, cpu };
      }
    }
    return { outcome: 0, player, cpu };
  }

  function sortForShowdown(cards) {
    const counts = frequencies(cards);
    return [...cards].sort((a, b) => (counts.get(b.id) - counts.get(a.id)) || b.strength - a.strength);
  }

  function cpuChanges() {
    const counts = frequencies(cpuHand);
    if ([...counts.values()].some((count) => count >= 2)) return cpuHand.map((card) => counts.get(card.id) === 1);
    const strongest = Math.max(...cpuHand.map((card) => card.strength));
    let kept = false;
    return cpuHand.map((card) => {
      if (!kept && card.strength === strongest) { kept = true; return false; }
      return true;
    });
  }

  function makeCard(card, index, owner) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "picture-card";
    button.style.setProperty("--card-delay", `${index * 55}ms`);
    const hidden = owner === "cpu" && !["showdown", "result"].includes(phase);
    if (!card || hidden) button.classList.add("is-back");
    if (owner === "player" && index === selected && phase === "select") button.classList.add("is-selected");
    if (owner === "player" && changes[index]) button.classList.add("is-change");
    if (dealingAnimation) button.classList.add("is-dealing");
    if (owner === replacingOwner && index === replacingIndex) button.classList.add("is-replacing");
    button.disabled = owner !== "player" || phase !== "select";
    button.setAttribute("aria-label", hidden ? `CPUの伏せカード ${index + 1}` : card ? card.name : "伏せカード");
    button.innerHTML = card && !hidden
      ? `<span class="picture-card__face"><b class="picture-card__symbol" style="color:${card.color}">${card.symbol}</b><small class="picture-card__name">${card.name}</small></span>`
      : "<span class=\"picture-card__face\"></span>";
    if (owner === "player") button.addEventListener("click", () => { selected = index; toggleChange(index); });
    return button;
  }

  function actionLabel() {
    if (phase === "select") return changes.some(Boolean) ? "CHANGE" : "GO!";
    if (phase === "result") return coins > 0 ? "NEXT" : "RESTART";
    return "DEAL";
  }

  function render() {
    ui.hand.replaceChildren(...hand.map((card, index) => makeCard(card, index, "player")));
    ui.cpuHand.replaceChildren(...cpuHand.map((card, index) => makeCard(card, index, "cpu")));
    ui.coins.textContent = String(coins);
    ui.bet.textContent = String(bet);
    ui.round.textContent = `ROUND ${String(round).padStart(2, "0")}`;
    ui.mode.textContent = phase === "select" ? `${changes.filter(Boolean).length} CHANGE` : `BET ${bet}`;
    const canBet = ["idle", "result"].includes(phase) && !animating && coins > 0;
    ui.betDown.disabled = !canBet || bet <= 1;
    ui.betUp.disabled = !canBet || bet >= Math.min(5, Math.max(1, coins));
    ui.action.disabled = animating || (phase === "idle" && coins < bet);
    ui.action.textContent = actionLabel();
    ui.start.textContent = actionLabel();
  }

  function changeBet(step) {
    if (!["idle", "result"].includes(phase) || animating || coins <= 0) {
      ui.status.textContent = "BET変更は次のDEAL前にできます";
      sound("back");
      return;
    }
    bet = Math.max(1, Math.min(5, Math.min(coins, bet + step)));
    sound("move");
    render();
  }

  async function deal() {
    if (animating || coins < bet) return;
    const token = ++gameToken;
    coins -= bet;
    round += 1;
    selected = 0;
    changes = [false, false, false, false, false];
    phase = "dealing";
    animating = true;
    hand = [];
    cpuHand = [];
    deck = shuffle(makeDeck());
    ui.status.textContent = "YOU / CPU にカードを配っています…";
    render();
    await wait(180);
    hand = deck.splice(0, 5);
    cpuHand = deck.splice(0, 5);
    dealingAnimation = true;
    sound("deal");
    render();
    await wait(520);
    if (token !== gameToken) return;
    dealingAnimation = false;
    animating = false;
    phase = "select";
    ui.status.textContent = "カードをタップ、または十字＋Aで選択。STARTをタップ、またはSで決定";
    render();
  }

  function toggleChange(index) {
    if (phase !== "select" || animating) return;
    changes[index] = !changes[index];
    sound(changes[index] ? "hold" : "back");
    render();
  }

  async function replaceCards(cards, targets, owner, token) {
    for (let i = 0; i < cards.length; i += 1) {
      if (!targets[i]) continue;
      cards[i] = deck.shift();
      replacingOwner = owner;
      replacingIndex = i;
      sound("flip");
      render();
      await wait(170);
      if (token !== gameToken) return false;
    }
    replacingOwner = "";
    replacingIndex = -1;
    return true;
  }

  async function exchangeAndShowdown() {
    if (phase !== "select" || animating) return;
    const token = gameToken;
    phase = "exchange";
    animating = true;
    ui.status.textContent = changes.some(Boolean) ? "あなたのカードを交換中…" : "YOU STAND";
    render();
    if (!await replaceCards(hand, changes, "player", token)) return;
    await wait(220);
    const cpuTargets = cpuChanges();
    ui.status.textContent = cpuTargets.some(Boolean) ? `CPU CHANGE ×${cpuTargets.filter(Boolean).length}` : "CPU STAND";
    render();
    await wait(350);
    if (!await replaceCards(cpuHand, cpuTargets, "cpu", token)) return;
    await wait(280);
    phase = "showdown";
    hand = sortForShowdown(hand);
    cpuHand = sortForShowdown(cpuHand);
    changes = [false, false, false, false, false];
    ui.status.textContent = "SHOW DOWN!";
    sound("deal");
    render();
    await wait(700);
    if (token !== gameToken) return;
    settleRound();
  }

  function settleRound() {
    const result = compareHands(hand, cpuHand);
    phase = "result";
    animating = false;
    if (result.outcome > 0) {
      const winnings = bet * (Math.max(1, result.player.multiplier) + 1);
      coins += winnings;
      ui.status.textContent = `YOU WIN! ${result.player.name}  +${winnings} COIN`;
      sound("win");
    } else if (result.outcome < 0) {
      ui.status.textContent = `YOU LOSE  ${result.player.name} < ${result.cpu.name}`;
      sound("lose");
    } else {
      coins += bet;
      ui.status.textContent = `DRAW  ${result.player.name}  BET RETURN`;
      sound("coin");
    }
    bet = Math.min(bet, Math.max(coins, 1));
    render();
  }

  function action() {
    if (phase === "idle") deal();
    else if (phase === "select") exchangeAndShowdown();
    else if (phase === "result") coins > 0 ? deal() : resetSession();
  }

  function moveSelection(step) {
    if (phase !== "select") return;
    selected = (selected + step + 5) % 5;
    sound("move");
    render();
  }

  function clearChanges() {
    if (phase !== "select") return;
    changes = [false, false, false, false, false];
    sound("back");
    render();
  }

  function resetSession() {
    gameToken += 1;
    coins = 20;
    bet = 1;
    round = 0;
    hand = [];
    cpuHand = [];
    deck = [];
    changes = [false, false, false, false, false];
    selected = 0;
    phase = "idle";
    animating = false;
    dealingAnimation = false;
    replacingOwner = "";
    replacingIndex = -1;
    ui.status.textContent = "DEALをタップ、またはSTARTで開始";
    render();
  }

  ui.action.addEventListener("click", action);
  ui.betDown.addEventListener("click", () => changeBet(-1));
  ui.betUp.addEventListener("click", () => changeBet(1));
  document.addEventListener("pocket-input", (event) => {
    const input = event.detail.action;
    if (["left", "up"].includes(input)) moveSelection(-1);
    else if (["right", "down"].includes(input)) moveSelection(1);
    else if (input === "a") toggleChange(selected);
    else if (input === "b") clearChanges();
    else if (input === "select") changeBet(1);
    else if (input === "start") action();
  });

  resetSession();
})();
