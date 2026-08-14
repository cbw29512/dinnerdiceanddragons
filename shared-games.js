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
      logError("Unable to update game status", error);
    }
  }

  function writeErrorMessage(error, action) {
    try {
      return error.message === "Shared pilot writes are disabled"
        ? `Seat changes are temporarily read-only; ${action} is unavailable right now.`
        : `Could not ${action}: ${error.message || "request failed"}`;
    } catch (nestedError) {
      logError("Unable to format game action error", nestedError);
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
        confirmed: "Your seat is confirmed.",
        requested: "Your seat request was sent to the DM.",
        waitlisted: "The table is full, so you were added to the waitlist."
      };
      setStatus(messages[result.status] || `Your registration status is ${result.status}.`);
      await loadGames();
    } catch (error) {
      logError("Unable to request seat", error);
      setStatus(writeErrorMessage(error, "request the seat"));
    }
  }

  async function cancelSeat(game) {
    try {
      setStatus(`Cancelling your registration for ${game.title}…`);
      await window.DDDSharedRegistration.cancel(game.game_id);
      setStatus("Your registration was cancelled. If the table had a waitlist, the next seat is recalculated automatically.");
      await loadGames();
    } catch (error) {
      logError("Unable to cancel seat", error);
      setStatus(writeErrorMessage(error, "cancel the registration"));
    }
  }

  function renderGame(game, registration) {
    try {
      const card = make("article", null, "status-card");
      card.appendChild(make("p", String(game.status || "forming").toUpperCase(), "eyebrow"));
      card.appendChild(make("h3", game.title || "Forming Table"));
      card.appendChild(make("p", `${game.system || "RPG"} · ${game.starts_at || "Schedule pending"}`, "muted"));
      const venue = game.venue ? `${game.venue.name}${game.venue.city ? ` · ${game.venue.city}, ${game.venue.state}` : ""}` : "Venue still needed";
      card.appendChild(make("p", venue, "muted"));
      card.appendChild(make("p", `${Number(game.confirmed_players || 0)} confirmed · ${Number(game.requested_players || 0)} requested · ${Number(game.max_players || 0)} Player seats · ${Number(game.waitlisted_players || 0)} waitlisted`, "muted"));
      card.appendChild(make("p", game.venue_approved ? "Venue approved" : "Venue approval still needed", "muted"));

      const playerId = window.DDDSharedRegistration.playerId();
      if (registration) {
        card.appendChild(make("p", `Your status: ${String(registration.status).toUpperCase()}`, "eyebrow"));
        const cancel = make("button", registration.status === "requested" ? "Cancel My Request" : "Cancel My Seat", "button");
        cancel.type = "button";
        cancel.addEventListener("click", () => cancelSeat(game));
        card.appendChild(cancel);
      } else {
        const label = !playerId ? "Save My Player Preferences to Join" : String(game.join_mode || "").toLowerCase().includes("request") ? "Request a Seat" : "Join This Table";
        const action = make("button", label, "button");
        action.type = "button";
        action.addEventListener("click", () => requestSeat(game));
        card.appendChild(action);
      }
      return card;
    } catch (error) {
      logError("Unable to render forming game", error);
      return null;
    }
  }

  async function loadGames() {
    try {
      if (!list || !mode) return;
      list.replaceChildren();
      if (!window.DDD_API?.isConfigured()) return renderDisconnected();

      mode.textContent = "FORMING GAMES · EARLY ACCESS";
      setStatus("Loading forming games…");
      const [gamesResult, registrationMap] = await Promise.all([window.DDD_API.get("games.list"), window.DDDSharedRegistration.loadMap()]);
      if (!gamesResult.ok || !Array.isArray(gamesResult.games)) throw new Error(gamesResult.error || "Invalid game-list response");
      gamesResult.games.forEach((game) => {
        const card = renderGame(game, registrationMap[String(game.game_id)] || null);
        if (card) list.appendChild(card);
      });
      if (!gamesResult.games.length) {
        const empty = make("article", null, "status-card");
        empty.appendChild(make("h3", "No forming games are listed yet."));
        empty.appendChild(make("p", "Save what you want to play. Your Player preferences can help a DM see what local Players are looking for.", "muted"));
        const action = make("a", "Tell DMs What I Want to Play", "button");
        action.href = "join.html#player";
        empty.appendChild(action);
        list.appendChild(empty);
      }
      setStatus(`${gamesResult.games.length} forming table${gamesResult.games.length === 1 ? "" : "s"} available.`);
    } catch (error) {
      logError("Unable to load forming games", error);
      mode.textContent = "FORMING GAMES · TEMPORARILY UNAVAILABLE";
      setStatus("Live game listings are unavailable right now. You can still save your Player preferences or preview how a forming table works.");
    }
  }

  function renderDisconnected() {
    try {
      mode.textContent = "FORMING GAMES · SAMPLE";
      const card = make("article", null, "status-card");
      card.appendChild(make("h3", "See what a forming table looks like."));
      card.appendChild(make("p", "Live shared listings are not connected on this public preview right now, but you can explore a complete example table and see what Players will know before committing.", "muted"));
      const preview = make("a", "See a Forming Table", "button");
      preview.href = "games/shadows-over-florence/";
      card.appendChild(preview);
      list.appendChild(card);
      setStatus("Showing a sample forming table while live listings are unavailable.");
    } catch (error) {
      logError("Unable to render forming-game fallback", error);
    }
  }

  try {
    loadGames();
  } catch (error) {
    logError("Unable to initialize game discovery", error);
  }
})();
