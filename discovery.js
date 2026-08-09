(() => {
  "use strict";

  const grid = document.querySelector("#game-grid");
  const games = Array.isArray(window.DDD_GAMES) ? window.DDD_GAMES : [];

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function makeText(tagName, text, className = "") {
    const node = document.createElement(tagName);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function buildDetails(game) {
    const details = document.createElement("div");
    details.className = "game-details";
    details.hidden = true;
    [
      ["Joining", game.joinMode],
      ["Duration", game.duration],
      ["Table culture", game.tableCulture],
      ["GM trust", game.gmTrust],
      ["Venue", game.accessibility]
    ].forEach(([label, value]) => {
      const row = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = `${label}: `;
      row.append(strong, document.createTextNode(value || "Details coming soon"));
      details.appendChild(row);
    });
    const joinLink = document.createElement("a");
    joinLink.className = "button primary";
    joinLink.href = "join.html#player-signup";
    joinLink.textContent = "Create Player Profile to Join";
    details.appendChild(joinLink);
    return details;
  }

  function buildGameCard(game, distanceMiles = null) {
    try {
      const article = document.createElement("article");
      article.className = "game-card";
      article.append(makeText("p", game.system, "eyebrow"), makeText("h3", game.title));
      article.append(makeText("p", `${game.type} · ${game.when} · ${game.venue}`, "game-meta"));
      if (Number.isFinite(distanceMiles)) article.append(makeText("p", `📍 About ${distanceMiles.toFixed(1)} miles away`, "distance-label"));
      article.append(makeText("p", game.style), makeText("strong", game.seats));

      const tags = document.createElement("div");
      tags.className = "tag-row";
      (game.tags || []).forEach((label) => tags.append(makeText("span", label)));
      article.appendChild(tags);

      const details = buildDetails(game);
      const actions = document.createElement("div");
      actions.className = "game-actions";

      const detailsButton = document.createElement("button");
      detailsButton.type = "button";
      detailsButton.textContent = "Details";
      detailsButton.setAttribute("aria-expanded", "false");
      detailsButton.addEventListener("click", () => {
        try {
          const opening = details.hidden;
          details.hidden = !opening;
          detailsButton.setAttribute("aria-expanded", String(opening));
          detailsButton.textContent = opening ? "Hide Details" : "Details";
        } catch (error) { logError("Unable to toggle game details", error); }
      });

      const passButton = document.createElement("button");
      passButton.type = "button";
      passButton.textContent = "Pass";
      passButton.addEventListener("click", () => {
        try { article.hidden = true; } catch (error) { logError("Unable to pass game", error); }
      });

      const interestButton = document.createElement("button");
      interestButton.type = "button";
      interestButton.className = "interested";
      interestButton.textContent = "♥ Interested";
      interestButton.setAttribute("aria-pressed", "false");
      interestButton.addEventListener("click", () => {
        try {
          const pressed = interestButton.getAttribute("aria-pressed") === "true";
          interestButton.setAttribute("aria-pressed", String(!pressed));
          interestButton.textContent = pressed ? "♥ Interested" : "✓ Interested";
        } catch (error) { logError("Unable to update interest state", error); }
      });

      actions.append(detailsButton, passButton, interestButton);
      article.append(actions, details);
      return article;
    } catch (error) {
      logError("Unable to build game card", error);
      return null;
    }
  }

  function renderGames(results = games.map((game) => ({ game, distanceMiles: null }))) {
    try {
      if (!grid) throw new Error("Game grid container was not found.");
      grid.replaceChildren();
      if (!results.length) {
        const empty = document.createElement("div");
        empty.className = "panel empty-state";
        empty.innerHTML = "<h3>No tables inside that travel radius yet.</h3><p>Try a larger radius or select Show All Games.</p>";
        grid.appendChild(empty);
        return;
      }
      results.forEach(({ game, distanceMiles }) => {
        const card = buildGameCard(game, distanceMiles);
        if (card) grid.appendChild(card);
      });
    } catch (error) {
      logError("Unable to render games", error);
      if (grid) grid.textContent = "Game previews are temporarily unavailable.";
    }
  }

  window.DDDDiscovery = { games, renderGames };
})();
