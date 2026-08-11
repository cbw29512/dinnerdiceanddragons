(() => {
  "use strict";

  const SERIES_KEY = "ddd-series-preview";
  const COMMITMENT_KEY = "ddd-series-commitments";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function humanDate(value) {
    try {
      return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
    } catch (error) {
      logError("Unable to format date", error);
      return value;
    }
  }

  function readSeries() {
    try {
      const raw = localStorage.getItem(SERIES_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      logError("Unable to read series", error);
      return null;
    }
  }

  function defaultState(series) {
    try {
      const core = ["Wendy", "Alex"].map((name, index) => ({ id: `core-${index + 1}`, name }));
      const requests = ["Sarah", "Mike"].map((name, index) => ({ id: `req-${index + 1}`, name, status: "pending" }));
      return {
        seriesId: series.id,
        venue: { name: series.venue, gmAccepted: false, venueConfirmed: false },
        corePlayers: core,
        playerRequests: requests,
        intents: Object.fromEntries(series.sessions.map((session) => [session.id, Object.fromEntries(core.map((player) => [player.id, "yes"]))])),
        guests: Object.fromEntries(series.sessions.map((session) => [session.id, 0])),
        waitlist: Object.fromEntries(series.sessions.map((session) => [session.id, 0]))
      };
    } catch (error) {
      logError("Unable to create default commitment state", error);
      return { seriesId: series?.id || "", venue: { name: series?.venue || "", gmAccepted: false, venueConfirmed: false }, corePlayers: [], playerRequests: [], intents: {}, guests: {}, waitlist: {} };
    }
  }

  function normalizeState(series, state) {
    try {
      state.venue ||= { name: series.venue, gmAccepted: false, venueConfirmed: false };
      state.playerRequests ||= [];
      state.corePlayers ||= [];
      state.intents ||= {};
      state.guests ||= {};
      state.waitlist ||= {};
      return state;
    } catch (error) {
      logError("Unable to normalize commitment state", error);
      return defaultState(series);
    }
  }

  function readState(series) {
    try {
      const raw = localStorage.getItem(COMMITMENT_KEY);
      if (!raw) return defaultState(series);
      const parsed = JSON.parse(raw);
      return parsed.seriesId === series.id ? normalizeState(series, parsed) : defaultState(series);
    } catch (error) {
      logError("Unable to read commitment state", error);
      return defaultState(series);
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(COMMITMENT_KEY, JSON.stringify(state));
    } catch (error) {
      logError("Unable to save commitment state", error);
    }
  }

  function sessionCounts(series, state, session) {
    try {
      const intentMap = state.intents[session.id] || {};
      const yes = state.corePlayers.filter((player) => intentMap[player.id] === "yes").length;
      const unsure = state.corePlayers.filter((player) => intentMap[player.id] === "unsure").length;
      const guests = Number(state.guests[session.id]) || 0;
      const expected = yes + guests;
      const openSeats = Math.max(0, series.maxPlayers - expected);
      const deficit = Math.max(0, series.minPlayers - expected);
      const health = deficit > 0 ? "at-risk" : openSeats > 0 ? "open" : "healthy";
      return { yes, unsure, guests, expected, openSeats, deficit, health };
    } catch (error) {
      logError("Unable to calculate session counts", error);
      return { yes: 0, unsure: 0, guests: 0, expected: 0, openSeats: 0, deficit: series.minPlayers, health: "at-risk" };
    }
  }

  function renderSummary(series, state) {
    try {
      const summary = document.querySelector("#commitment-summary");
      if (!summary) return;
      const atRisk = series.sessions.filter((session) => sessionCounts(series, state, session).health === "at-risk").length;
      const venueStatus = state.venue.gmAccepted ? (state.venue.venueConfirmed ? "Venue confirmed" : "GM accepted · awaiting venue") : "GM venue decision needed";
      summary.innerHTML = `<p class="eyebrow">GM COORDINATED · ${series.status.toUpperCase()} SERIES</p><h2>${series.title}</h2><p>${series.system} · ${series.venue} · ${state.corePlayers.length} GM-approved core Players · ${series.sessions.length} planned sessions</p><div class="hub-metrics"><div><strong>${series.minPlayers}</strong><span>Minimum Players</span></div><div><strong>${state.playerRequests.filter((r) => r.status === "pending").length}</strong><span>Pending Player requests</span></div><div><strong>${atRisk}</strong><span>Sessions at risk</span></div><div><strong>${venueStatus}</strong><span>Venue status</span></div></div>`;
    } catch (error) {
      logError("Unable to render commitment summary", error);
    }
  }

  function renderVenueApproval(state) {
    try {
      const box = document.querySelector("#venue-approval");
      if (!box) return;
      const gm = state.venue.gmAccepted ? "✓ GM accepted" : "Pending GM decision";
      const venue = state.venue.venueConfirmed ? "✓ Venue confirmed" : "Venue confirmation pending";
      box.innerHTML = `<div class="panel"><h3>${state.venue.name}</h3><p>${gm} · ${venue}</p><div class="game-actions">${state.venue.gmAccepted ? '<button type="button" data-venue-action="change">Choose Another Venue</button>' : '<button class="interested" type="button" data-venue-action="accept">Accept This Venue</button>'}<button type="button" data-venue-action="confirm">${state.venue.venueConfirmed ? "Revoke Venue Confirmation" : "Simulate Venue Confirmation"}</button></div></div>`;
    } catch (error) {
      logError("Unable to render venue approval", error);
    }
  }

  function renderPlayerRequests(state) {
    try {
      const box = document.querySelector("#player-requests");
      if (!box) return;
      const pending = state.playerRequests.filter((request) => request.status === "pending");
      if (!pending.length) {
        box.innerHTML = "<p>No pending Player requests.</p>";
        return;
      }
      box.innerHTML = pending.map((request) => `<div class="venue-schedule-row"><strong>${request.name}</strong><span>Request to join</span><button class="button primary" type="button" data-request-action="approve" data-request-id="${request.id}">Accept</button><button class="button secondary" type="button" data-request-action="decline" data-request-id="${request.id}">Decline</button></div>`).join("");
    } catch (error) {
      logError("Unable to render Player requests", error);
    }
  }

  function renderCoreParty(state) {
    try {
      const box = document.querySelector("#core-party");
      if (!box) return;
      if (!state.corePlayers.length) {
        box.innerHTML = "<p>No GM-approved core Players yet.</p>";
        return;
      }
      box.innerHTML = state.corePlayers.map((player) => `<div class="venue-schedule-row"><strong>${player.name}</strong><span>GM approved</span><span>Core member</span><button class="button secondary" type="button" data-remove-core="${player.id}">Remove</button></div>`).join("");
    } catch (error) {
      logError("Unable to render core party", error);
    }
  }

  function renderHealth(series, state) {
    try {
      const box = document.querySelector("#session-health");
      if (!box) return;
      box.innerHTML = series.sessions.map((session) => {
        const counts = sessionCounts(series, state, session);
        const label = counts.health === "at-risk" ? `At risk · needs ${counts.deficit}` : counts.health === "open" ? `Viable · ${counts.openSeats} open` : "Full / healthy";
        return `<div class="venue-schedule-row"><strong>${humanDate(session.date)}</strong><span>${counts.expected}/${series.maxPlayers} expected</span><span>${label}</span><span>${Number(state.waitlist[session.id]) || 0} waiting</span></div>`;
      }).join("");
    } catch (error) {
      logError("Unable to render session health", error);
    }
  }

  function renderMatrix(series, state) {
    try {
      const box = document.querySelector("#commitment-matrix");
      if (!box) return;
      if (!state.corePlayers.length) {
        box.innerHTML = "<p>Approve a Player request to begin tracking attendance intent.</p>";
        return;
      }
      box.innerHTML = series.sessions.map((session) => {
        const playerRows = state.corePlayers.map((player) => {
          const value = state.intents[session.id]?.[player.id] || "unsure";
          return `<label>${player.name}<select data-intent-session="${session.id}" data-intent-player="${player.id}"><option value="yes" ${value === "yes" ? "selected" : ""}>Yes</option><option value="unsure" ${value === "unsure" ? "selected" : ""}>Unsure</option><option value="no" ${value === "no" ? "selected" : ""}>Can't attend</option></select></label>`;
        }).join("");
        const counts = sessionCounts(series, state, session);
        return `<fieldset class="availability-entry"><legend>${humanDate(session.date)} · ${counts.expected} expected</legend>${playerRows}<label>GM-approved session guests<input type="number" min="0" max="${series.maxPlayers}" value="${Number(state.guests[session.id]) || 0}" data-guest-session="${session.id}"></label><label>Waitlist requests<input type="number" min="0" max="20" value="${Number(state.waitlist[session.id]) || 0}" data-waitlist-session="${session.id}"></label><p class="recurrence-summary microcopy">${counts.health === "at-risk" ? `At risk: GM should approve ${counts.deficit} compatible Player${counts.deficit === 1 ? "" : "s"}.` : counts.openSeats ? `${counts.openSeats} seat${counts.openSeats === 1 ? "" : "s"} still open for GM approval.` : "Session is full."}</p></fieldset>`;
      }).join("");
    } catch (error) {
      logError("Unable to render commitment matrix", error);
    }
  }

  function rerender(series, state, message = "") {
    try {
      renderSummary(series, state);
      renderVenueApproval(state);
      renderPlayerRequests(state);
      renderCoreParty(state);
      renderHealth(series, state);
      renderMatrix(series, state);
      const status = document.querySelector("#commitment-status");
      if (status) status.textContent = message;
    } catch (error) {
      logError("Unable to refresh commitment dashboard", error);
    }
  }

  function approvePlayer(series, state, requestId) {
    try {
      const request = state.playerRequests.find((item) => item.id === requestId);
      if (!request) throw new Error("Player request not found.");
      if (state.corePlayers.length >= series.maxPlayers) throw new Error("Core party is already at maximum seats.");
      request.status = "approved";
      const id = `core-${Date.now()}`;
      state.corePlayers.push({ id, name: request.name, sourceRequestId: request.id });
      series.sessions.forEach((session) => {
        state.intents[session.id] ||= {};
        state.intents[session.id][id] = "yes";
      });
      saveState(state);
      rerender(series, state, `${request.name} accepted by the GM.`);
    } catch (error) {
      logError("Unable to approve Player", error);
      const status = document.querySelector("#commitment-status");
      if (status) status.textContent = error.message || "Unable to approve Player.";
    }
  }

  function declinePlayer(series, state, requestId) {
    try {
      const request = state.playerRequests.find((item) => item.id === requestId);
      if (!request) throw new Error("Player request not found.");
      request.status = "declined";
      saveState(state);
      rerender(series, state, `${request.name} request declined. No public reputation effect is created.`);
    } catch (error) {
      logError("Unable to decline Player", error);
    }
  }

  function addRequest(series, state, name) {
    try {
      const trimmed = String(name || "").trim();
      if (!trimmed) throw new Error("Player display name is required.");
      const duplicate = [...state.corePlayers, ...state.playerRequests.filter((r) => r.status === "pending")].some((player) => player.name.toLowerCase() === trimmed.toLowerCase());
      if (duplicate) throw new Error("That Player is already approved or pending.");
      state.playerRequests.push({ id: `req-${Date.now()}`, name: trimmed, status: "pending" });
      saveState(state);
      rerender(series, state, `${trimmed} requested to join. GM approval required.`);
    } catch (error) {
      logError("Unable to add Player request", error);
      const status = document.querySelector("#commitment-status");
      if (status) status.textContent = error.message || "Unable to add request.";
    }
  }

  function removePlayer(series, state, playerId) {
    try {
      const player = state.corePlayers.find((item) => item.id === playerId);
      state.corePlayers = state.corePlayers.filter((item) => item.id !== playerId);
      series.sessions.forEach((session) => { if (state.intents[session.id]) delete state.intents[session.id][playerId]; });
      saveState(state);
      rerender(series, state, `${player?.name || "Player"} removed from the core party by the GM.`);
    } catch (error) {
      logError("Unable to remove core Player", error);
    }
  }

  function handleVenueAction(series, state, action) {
    try {
      if (action === "accept") state.venue.gmAccepted = true;
      if (action === "change") {
        state.venue.gmAccepted = false;
        state.venue.venueConfirmed = false;
      }
      if (action === "confirm") state.venue.venueConfirmed = !state.venue.venueConfirmed;
      saveState(state);
      const message = action === "accept" ? `${state.venue.name} accepted by the GM.` : action === "change" ? "Venue released. Choose another compatible venue." : `Venue confirmation ${state.venue.venueConfirmed ? "recorded" : "revoked"}.`;
      rerender(series, state, message);
    } catch (error) {
      logError("Unable to update venue approval", error);
    }
  }

  function bind() {
    try {
      const series = readSeries();
      const summary = document.querySelector("#commitment-summary");
      if (!series) {
        if (summary) summary.innerHTML = '<h2>No forming series found.</h2><p>Create a recurring series first.</p><a class="button primary" href="form-series.html">Form a Series</a>';
        return;
      }
      const state = readState(series);
      rerender(series, state);

      document.querySelector("#add-player-request")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = document.querySelector("#request-player-name");
        addRequest(series, state, input?.value);
        if (input) input.value = "";
      });

      document.querySelector("#player-requests")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-request-action]");
        if (!button) return;
        if (button.dataset.requestAction === "approve") approvePlayer(series, state, button.dataset.requestId);
        if (button.dataset.requestAction === "decline") declinePlayer(series, state, button.dataset.requestId);
      });

      document.querySelector("#venue-approval")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-venue-action]");
        if (button) handleVenueAction(series, state, button.dataset.venueAction);
      });

      document.querySelector("#core-party")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-remove-core]");
        if (button) removePlayer(series, state, button.dataset.removeCore);
      });

      document.querySelector("#commitment-matrix")?.addEventListener("change", (event) => {
        try {
          const intent = event.target.closest("[data-intent-session]");
          if (intent) {
            const sessionId = intent.dataset.intentSession;
            const playerId = intent.dataset.intentPlayer;
            state.intents[sessionId] ||= {};
            state.intents[sessionId][playerId] = intent.value;
          }
          const guest = event.target.closest("[data-guest-session]");
          if (guest) state.guests[guest.dataset.guestSession] = Math.max(0, Number(guest.value) || 0);
          const waitlist = event.target.closest("[data-waitlist-session]");
          if (waitlist) state.waitlist[waitlist.dataset.waitlistSession] = Math.max(0, Number(waitlist.value) || 0);
          saveState(state);
          rerender(series, state, "Commitment plan updated. Planning ahead has no reputation penalty.");
        } catch (error) {
          logError("Unable to update commitment intent", error);
        }
      });
    } catch (error) {
      logError("Unable to initialize series commitments", error);
    }
  }

  bind();
})();
