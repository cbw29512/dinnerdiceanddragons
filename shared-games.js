(() => {
  "use strict";

  const list = document.querySelector("#shared-games-list");
  const mode = document.querySelector("#shared-games-mode");
  const status = document.querySelector("#shared-games-status");

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function make(tag, text, className) {
    try {
      const node = document.createElement(tag);
      if (text !== undefined && text !== null) node.textContent = String(text);
      if (className) node.className = className;
      return node;
    } catch (error) {
      logError(`Unable to create ${tag}`, error);
      return document.createElement("span");
    }
  }

  function setStatus(message) {
    try {
      if (status) status.textContent = message;
    } catch (error) {
      logError("Unable to update shared game status", error);
    }
  }

  async function requestSeat(game) {
    try {
      const playerId = localStorage.getItem("ddd-player-id") || "";
      if (!playerId) {
        window.location.href = "join.html#player";
        return;
      }
      setStatus(`Requesting a seat at ${game.title}…`);
      const result = await window.DDD_API.post("game.join", { game_id:game.game_id, player_id:playerId });
      if (!result.ok) throw new Error(result.error || "Seat request failed");
      const messages = {
        confirmed:"Your seat is confirmed in the shared pilot.",
        requested:"Your seat request was sent to the shared pilot.",
        waitlisted:"The table is full; you were added to the shared pilot waitlist."
      };
      setStatus(messages[result.status] || `Registration status: ${result.status}.`);
      await loadGames();
    } catch (error) {
      logError("Unable to request shared pilot seat", error);
      setStatus(error.message === "Shared pilot writes are disabled" ? "The shared pilot is currently read-only; seat requests are disabled." : `Could not request the seat: ${error.message || "request failed"}`);
    }
  }

  function renderGame(game) {
    try {
      const card = make("article", null, "status-card");
      card.appendChild(make("p", String(game.status || "forming").toUpperCase(), "eyebrow"));
      card.appendChild(make("h3", game.title || "Forming Table"));
      card.appendChild(make("p", `${game.system || "RPG"} · ${game.starts_at || "Schedule pending"}`, "muted"));
      const venue = game.venue ? `${game.venue.name}${game.venue.city ? ` · ${game.venue.city}, ${game.venue.state}` : ""}` : "Venue pending";
      card.appendChild(make("p", venue, "muted"));
      card.appendChild(make("p", `${Number(game.confirmed_players || 0)} confirmed · ${Number(game.max_players || 0)} Player seats · ${Number(game.waitlisted_players || 0)} waitlisted`, "muted"));

      const playerId = localStorage.getItem("ddd-player-id") || "";
      const action = make("button", playerId ? (String(game.join_mode || "").toLowerCase().includes("request") ? "Request a Seat" : "Join This Table") : "Save Player Signal to Join", "button");
      action.type = "button";
      action.addEventListener("click", () => requestSeat(game));
      card.appendChild(action);
      return card;
    } catch (error) {
      logError("Unable to render shared pilot game", error);
      return null;
    }
  }

  async function loadGames() {
    try {
      if (!list || !mode) return;
      list.replaceChildren();
      if (!window.DDD_API?.isConfigured()) {
        mode.textContent = "SHARED PILOT · NOT CONNECTED";
        const card = make("article", null, "status-card");
        card.appendChild(make("h3", "Shared game listings are dormant."));
        card.appendChild(make("p", "The GitHub Pages validation site is still in local prototype mode. Configure the pilot API to replace this message with shared forming tables.", "muted"));
        card.appendChild(make("a", "Preview a Forming Table", "button"));
        card.lastChild.href = "games/shadows-over-florence/";
        list.appendChild(card);
        return;
      }

      mode.textContent = "SHARED PILOT · CONNECTED";
      setStatus("Loading shared forming tables…");
      const result = await window.DDD_API.get("games.list");
      if (!result.ok || !Array.isArray(result.games)) throw new Error(result.error || "Invalid game-list response");
      result.games.forEach((game) => {
        const card = renderGame(game);
        if (card) list.appendChild(card);
      });
      if (!result.games.length) {
        const empty = make("article", null, "status-card");
        empty.appendChild(make("h3", "No shared forming tables yet."));
        empty.appendChild(make("p", "Player demand can still help a GM decide what to form next.", "muted"));
        list.appendChild(empty);
      }
      setStatus(`${result.games.length} shared pilot table${result.games.length === 1 ? "" : "s"} available.`);
    } catch (error) {
      logError("Unable to load shared pilot games", error);
      mode.textContent = "SHARED PILOT · CONNECTION ERROR";
      setStatus("Shared game listings are unavailable right now; the rest of the validation prototype still works locally.");
    }
  }

  try {
    loadGames();
  } catch (error) {
    logError("Unable to initialize shared game discovery", error);
  }
})();
