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
      ["Status", game.status || "Forming"],
      ["Joining", game.joinMode],
      ["Duration", game.duration],
      ["Table fit", game.tableCulture],
      ["GM trust", game.gmTrust],
      ["Venue / environment", game.accessibility]
    ].forEach(([label, value]) => {
      const row = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = `${label}: `;
      row.append(strong, document.createTextNode(value || "Details coming soon"));
      details.appendChild(row);
    });

    return details;
  }

  function buildGameCard(game, distanceMiles = null) {
    try {
      const article = document.createElement("article");
      article.className = "game-card";
      article.append(
        makeText("p", `${game.status || "Forming"} · ${game.system}`, "eyebrow"),
        makeText("h3", game.title),
        makeText("p", `${game.type} · ${game.when} · ${game.venue}`, "game-meta")
      );

      if (Number.isFinite(distanceMiles)) {
        article.append(makeText("p", `📍 About ${distanceMiles.toFixed(1)} miles away`, "distance-label"));
      }

      article.append(makeText("p", game.style), makeText("strong", game.seats));

      const tags = document.createElement("div");
      tags.className = "tag-row";
      (game.tags || []).forEach((label) => tags.append(makeText("span", label)));
      article.appendChild(tags);

      const details = buildDetails(game);
      const actions = document.createElement("div");
      actions.className = "game-actions";

      const viewLink = document.createElement("a");
      viewLink.href = `games/${game.slug}/`;
      viewLink.textContent = "View Game";

      const detailsButton = document.createElement("button");
      detailsButton.type = "button";
      detailsButton.textContent = "Why It Fits";
      detailsButton.setAttribute("aria-expanded", "false");
      detailsButton.addEventListener("click", () => {
        try {
          const opening = details.hidden;
          details.hidden = !opening;
          detailsButton.setAttribute("aria-expanded", String(opening));
          detailsButton.textContent = opening ? "Hide Fit Details" : "Why It Fits";
        } catch (error) {
          logError("Unable to toggle Table Fit details", error);
        }
      });

      const fitButton = document.createElement("button");
      fitButton.type = "button";
      fitButton.className = "interested";
      fitButton.textContent = "Request This Game";
      fitButton.setAttribute("aria-pressed", "false");
      fitButton.addEventListener("click", () => {
        try {
          const pressed = fitButton.getAttribute("aria-pressed") === "true";
          fitButton.setAttribute("aria-pressed", String(!pressed));
          fitButton.textContent = pressed ? "Request This Game" : "✓ Added to My Games";
        } catch (error) {
          logError("Unable to update game interest", error);
        }
      });

      actions.append(viewLink, detailsButton, fitButton);
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
        empty.innerHTML = `
          <p class="eyebrow">NO GAME YET? THAT'S USEFUL.</p>
          <h3>No games match that travel range right now.</h3>
          <p>Tell us what you want to play and when you're free. Your availability can combine with nearby Players, a GM, and a willing venue to create the next game night.</p>
          <div class="cta-row">
            <a class="button primary" href="join.html#player">Add My Availability</a>
            <button class="button secondary" type="button" data-show-all-games>Show All Games</button>
          </div>`;
        const showAll = empty.querySelector("[data-show-all-games]");
        if (showAll) {
          showAll.addEventListener("click", () => renderGames());
        }
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
