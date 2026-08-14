(() => {
  "use strict";

  const list = document.querySelector("#shared-games-list");
  const mode = document.querySelector("#shared-games-mode");
  const status = document.querySelector("#shared-games-status");

  const SAMPLE_GAMES = Object.freeze([
    { title:"Shadows Over Florence", href:"games/shadows-over-florence/", note:"Sample forming D&D table" },
    { title:"The Lighthouse at Blackwater", href:"games/lighthouse-at-blackwater/", note:"Sample forming tabletop adventure" },
    { title:"Trouble Below the Old Road", href:"games/trouble-below-the-old-road/", note:"Sample forming tabletop adventure" }
  ]);

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
      logError("Unable to update forming-game status", error);
    }
  }

  function writeErrorMessage(error, action) {
    try {
      return error.message === "Shared pilot writes are disabled"
        ? `Early-access joining is currently read-only; ${action} is unavailable.`
        : `Could not ${action}: ${error.message || "request failed"}`;
    } catch (nestedError) {
      logError("Unable to format seat-request error", nestedError);
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
        confirmed:"Your seat is confirmed.",
        requested:"Your seat request was sent to the DM.",
        waitlisted:"The table is full; you were added to the waitlist."
      };
      setStatus(messages[result.status] || `Registration status: ${result.status}.`);
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
      setStatus("Your registration was cancelled. If someone was waiting, the open seat can now be recovered.");
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
      card.appendChild(make("p", `${Number(game.confirmed_players || 0)} confirmed · ${Number(game.requested_players || 0)} waiting for review · ${Number(game.max_players || 0)} Player seats · ${Number(game.waitlisted_players || 0)} waitlisted`, "muted"));
      card.appendChild(make("p", game.venue_approved ? "Venue confirmed" : "Venue confirmation still needed", "muted"));

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
      if (!window.DDD_API?.isConfigured()) return renderSamples();

      mode.textContent = "FORMING GAMES · EARLY ACCESS";
      setStatus("Loading forming tables…");
      const [gamesResult, registrationMap] = await Promise.all([window.DDD_API.get("games.list"), window.DDDSharedRegistration.loadMap()]);
      if (!gamesResult.ok || !Array.isArray(gamesResult.games)) throw new Error(gamesResult.error || "Invalid game-list response");
      gamesResult.games.forEach((game) => {
        const card = renderGame(game, registrationMap[String(game.game_id)] || null);
        if (card) list.appendChild(card);
      });
      if (!gamesResult.games.length) {
        const empty = make("article", null, "status-card");
        empty.appendChild(make("h3", "No forming tables are open right now."));
        empty.appendChild(make("p", "Save what you want to play. That interest can help a DM decide what to run next.", "muted"));
        const action = make("a", "Tell DMs What I Want to Play", "button");
        action.href = "join.html#player";
        empty.appendChild(action);
        list.appendChild(empty);
      }
      setStatus(`${gamesResult.games.length} forming table${gamesResult.games.length === 1 ? "" : "s"} available.`);
    } catch (error) {
      logError("Unable to load forming games", error);
      renderSamples("Live listings are unavailable right now, so these sample tables show what a forming game looks like.");
    }
  }

  function renderSamples(message = "These sample tables show the information Players can review before joining a real forming game.") {
    try {
      mode.textContent = "FORMING GAMES · SAMPLE";
      list.replaceChildren();
      SAMPLE_GAMES.forEach((sample) => {
        const card = make("article", null, "status-card");
        card.appendChild(make("p", "SAMPLE · FORMING", "eyebrow"));
        card.appendChild(make("h3", sample.title));
        card.appendChild(make("p", sample.note, "muted"));
        card.appendChild(make("p", "See the schedule, venue, table fit, and what the group still needs before committing.", "muted"));
        const preview = make("a", "View Sample Table", "button");
        preview.href = sample.href;
        card.appendChild(preview);
        list.appendChild(card);
      });
      setStatus(message);
    } catch (error) {
      logError("Unable to render sample forming games", error);
    }
  }

  try {
    loadGames();
  } catch (error) {
    logError("Unable to initialize forming-game discovery", error);
  }
})();