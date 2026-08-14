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

  function writeErrorMessage(error, action) {
    try {
      return error.message === "Shared pilot writes are disabled"
        ? `The shared pilot is currently read-only; ${action} is disabled.`
        : `Could not ${action}: ${error.message || "request failed"}`;
    } catch (nestedError) {
      logError("Unable to format shared write error", nestedError);
      return `Could not ${action}.`;
    }
  }

  async function requestSeat(game) {
    try {
      if (!window.DDDSharedRegistration.playerId()) {
        window.location.href = "join.html#player";
        return;
      }
      setStatus(`Requesting a seat at ${game.title}…`);
      const result = await window.DDDSharedRegistration.request(game.game_id);
      const messages = {
        confirmed:"Your seat is confirmed in the shared pilot.",
        requested:"Your seat request was sent to the shared pilot.",
        waitlisted:"The table is full; you were added to the shared pilot waitlist."
      };
      setStatus(messages[result.status] || `Registration status: ${result.status}.`);
      await loadGames();
    } catch (error) {
      logError("Unable to request shared pilot seat", error);
      setStatus(writeErrorMessage(error, "request the seat"));
    }
  }

  async function cancelSeat(game) {
    try {
      setStatus(`Cancelling your registration for ${game.title}…`);
      await window.DDDSharedRegistration.cancel(game.game_id);
      setStatus("Your shared pilot registration was cancelled. If a waitlist existed, recovery was recalculated automatically.");
      await loadGames();
    } catch (error) {
      logError("Unable to cancel shared pilot seat", error);
      setStatus(writeErrorMessage(error, "cancel the registration"));
    }
  }

  function renderGame(game, registration) {
    try {
      const card = make("article", null, "status-card");
      card.appendChild(make("p", String(game.status || "forming").toUpperCase(), "eyebrow"));
      card.appendChild(make("h3", game.title || "Forming Table"));
      card.appendChild(make("p", `${game.system || "RPG"} · ${game.starts_at || "Schedule pending"}`, "muted"));
      const venue = game.venue ? `${game.venue.name}${game.venue.city ? ` · ${game.venue.city}, ${game.venue.state}` : ""}` : "Venue pending";
      card.appendChild(make("p", venue, "muted"));
      card.appendChild(make("p", `${Number(game.confirmed_players || 0)} confirmed · ${Number(game.requested_players || 0)} requested · ${Number(game.max_players || 0)} Player seats · ${Number(game.waitlisted_players || 0)} waitlisted`, "muted"));
      card.appendChild(make("p", game.venue_approved ? "Venue approved" : "Venue approval still needed", "muted"));

      const playerId = window.DDDSharedRegistration.playerId();
      if (registration) {
        card.appendChild(make("p", `Your pilot status: ${String(registration.status).toUpperCase()}`, "eyebrow"));
        const cancel = make("button", registration.status === "requested" ? "Cancel My Request" : "Cancel My Seat", "button");
        cancel.type = "button";
        cancel.addEventListener("click", () => cancelSeat(game));
        card.appendChild(cancel);
      } else {
        const label = !playerId ? "Save Player Signal to Join" : String(game.join_mode || "").toLowerCase().includes("request") ? "Request a Seat" : "Join This Table";
        const action = make("button", label, "button");
        action.type = "button";
        action.addEventListener("click", () => requestSeat(game));
        card.appendChild(action);
      }
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
      if (!window.DDD_API?.isConfigured()) return renderDisconnected();

      mode.textContent = "SHARED PILOT · CONNECTED";
      setStatus("Loading shared forming tables…");
      const [gamesResult, registrationMap] = await Promise.all([window.DDD_API.get("games.list"), window.DDDSharedRegistration.loadMap()]);
      if (!gamesResult.ok || !Array.isArray(gamesResult.games)) throw new Error(gamesResult.error || "Invalid game-list response");
      gamesResult.games.forEach((game) => {
        const card = renderGame(game, registrationMap[String(game.game_id)] || null);
        if (card) list.appendChild(card);
      });
      if (!gamesResult.games.length) {
        const empty = make("article", null, "status-card");
        empty.appendChild(make("h3", "No shared forming tables yet."));
        empty.appendChild(make("p", "Player demand can still help a GM decide what to form next.", "muted"));
        list.appendChild(empty);
      }
      setStatus(`${gamesResult.games.length} shared pilot table${gamesResult.games.length === 1 ? "" : "s"} available.`);
    } catch (error) {
      logError("Unable to load shared pilot games", error);
      mode.textContent = "SHARED PILOT · CONNECTION ERROR";
      setStatus("Shared game listings are unavailable right now; the rest of the validation prototype still works locally.");
    }
  }

  function renderDisconnected() {
    try {
      mode.textContent = "SHARED PILOT · NOT CONNECTED";
      const card = make("article", null, "status-card");
      card.appendChild(make("h3", "Shared game listings are dormant."));
      card.appendChild(make("p", "The GitHub Pages validation site is still in local prototype mode. Configure the pilot API to replace this message with shared forming tables.", "muted"));
      const preview = make("a", "Preview a Forming Table", "button");
      preview.href = "games/shadows-over-florence/";
      card.appendChild(preview);
      list.appendChild(card);
    } catch (error) {
      logError("Unable to render disconnected shared pilot", error);
    }
  }

  try {
    loadGames();
  } catch (error) {
    logError("Unable to initialize shared game discovery", error);
  }
})();
