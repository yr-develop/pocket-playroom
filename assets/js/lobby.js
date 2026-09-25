(function () {
  "use strict";

  const games = Array.isArray(window.GAME_CATALOG) ? window.GAME_CATALOG : [];
  const grid = document.querySelector("#game-grid");
  const feature = document.querySelector("#game-feature");
  const count = document.querySelector("#game-count");
  let selectedIndex = 0;

  count.textContent = String(games.length).padStart(2, "0") + (games.length === 1 ? " GAME" : " GAMES");

  games.forEach((game, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "game-icon";
    button.dataset.index = String(index);
    button.setAttribute("role", "option");
    button.setAttribute("aria-label", game.title);
    button.innerHTML = `<span aria-hidden="true">${game.icon}</span>`;
    button.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") select(index); });
    button.addEventListener("focus", () => select(index));
    button.addEventListener("click", () => { select(index); window.PocketSound?.play("move"); });
    grid.append(button);
  });

  const icons = [...grid.querySelectorAll(".game-icon")];

  function renderFeature() {
    const game = games[selectedIndex];
    if (!game) return;
    feature.href = game.href;
    feature.setAttribute("aria-label", `${game.title}をプレイ`);
    feature.innerHTML = `
      <div class="game-feature__art" aria-hidden="true"><span>${game.icon}</span></div>
      <div class="game-feature__body">
        <span class="game-feature__number">CARTRIDGE ${String(selectedIndex + 1).padStart(2, "0")}</span>
        <h2>${game.title}</h2>
        <p>${game.description}</p>
        <span class="game-feature__tag">${game.tag}</span>
      </div>`;
  }

  function select(index) {
    if (!icons.length) return;
    selectedIndex = (index + icons.length) % icons.length;
    icons.forEach((icon, i) => {
      icon.classList.toggle("is-selected", i === selectedIndex);
      icon.setAttribute("aria-selected", String(i === selectedIndex));
    });
    icons[selectedIndex].scrollIntoView({ block: "nearest", behavior: "smooth" });
    renderFeature();
  }

  function moveSelection(step) {
    select(selectedIndex + step);
    window.PocketSound?.play("move");
  }

  function playSelected() {
    if (!games.length) return;
    window.PocketSound?.play("confirm");
    window.setTimeout(() => { window.location.href = games[selectedIndex].href; }, 90);
  }

  feature.addEventListener("click", () => window.PocketSound?.play("confirm"));
  document.addEventListener("pocket-input", (event) => {
    if (!icons.length) return;
    const action = event.detail.action;
    if (action === "right") moveSelection(1);
    else if (action === "left") moveSelection(-1);
    else if (action === "down") moveSelection(4);
    else if (action === "up") moveSelection(-4);
    else if (["a", "start"].includes(action)) playSelected();
    else if (["select", "b"].includes(action)) document.querySelector("[data-sound-toggle]")?.click();
  });

  select(0);
})();
