(() => {
  "use strict";

  const grid = document.querySelector("#game-grid");
  const games = Array.isArray(window.DDD_GAMES) ? window.DDD_GAMES : [];

  function createTag(label) {
    const tag = document.createElement("span");
    tag.textContent = label;
    return tag;
  }

  function buildGameCard(game) {
    try {
      const article = document.createElement("article");
      article.className = "game-card";

      const system = document.createElement("p");
      system.className = "eyebrow";
      system.textContent = game.system;

      const title = document.createElement("h3");
      title.textContent = game.title;

      const meta = document.createElement("p");
      meta.className = "game-meta";
      meta.textContent = `${game.type} · ${game.when} · ${game.venue}`;

      const style = document.createElement("p");
      style.textContent = game.style;

      const seats = document.createElement("strong");
      seats.textContent = game.seats;

      const tags = document.createElement("div");
      tags.className = "tag-row";
      game.tags.forEach((label) => tags.appendChild(createTag(label)));

      const actions = document.createElement("div");
      actions.className = "game-actions";

      const passButton = document.createElement("button");
      passButton.type = "button";
      passButton.textContent = "Pass";
      passButton.addEventListener("click", () => {
        article.setAttribute("aria-label", `${game.title} passed for this prototype session`);
        article.style.opacity = "0.55";
      });

      const interestButton = document.createElement("button");
      interestButton.type = "button";
      interestButton.className = "interested";
      interestButton.textContent = "♥ Interested";
      interestButton.addEventListener("click", () => {
        interestButton.textContent = "✓ Interested";
        interestButton.setAttribute("aria-pressed", "true");
      });

      actions.append(passButton, interestButton);
      article.append(system, title, meta, style, seats, tags, actions);
      return article;
    } catch (error) {
      console.error("Unable to build game card", error);
      return null;
    }
  }

  function renderGames() {
    try {
      if (!grid) {
        throw new Error("Game grid container was not found.");
      }

      games.forEach((game) => {
        const card = buildGameCard(game);
        if (card) grid.appendChild(card);
      });
    } catch (error) {
      console.error("Unable to render prototype games", error);
      if (grid) grid.textContent = "Game previews are temporarily unavailable.";
    }
  }

  renderGames();
})();
