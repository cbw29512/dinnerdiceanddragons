(() => {
  "use strict";

  const STORAGE_KEY = "ddd-series-preview";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function readSource() {
    try {
      const raw = sessionStorage.getItem("ddd-recurring-match-selected");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      logError("Unable to read selected recurring match", error);
      return null;
    }
  }

  function humanDate(value) {
    try {
      return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
    } catch (error) {
      logError("Unable to format session date", error);
      return value;
    }
  }

  function renderSource(source) {
    try {
      const box = document.querySelector("#series-source");
      if (!box) return;
      if (!source) return;
      box.innerHTML = `<p class="eyebrow">SELECTED RECURRING MATCH</p><h2>${source.system} · ${source.venue}</h2><p>${source.patternSummary} · ${source.viableCount}/${source.sessions.length} dates viable · ${source.compatiblePlayers} compatible Player signals</p>`;
      document.querySelector("#series-system-name").value = source.system;
      document.querySelector("#series-venue-name").value = source.venue;
    } catch (error) {
      logError("Unable to render series source", error);
    }
  }

  function renderSessions(source) {
    try {
      const list = document.querySelector("#series-session-list");
      if (!list) return;
      if (!source?.sessions?.length) {
        list.innerHTML = '<p>No session dates are available yet.</p>';
        return;
      }
      list.innerHTML = source.sessions.map((session, index) => {
        const checked = session.viable ? "checked" : "";
        const status = session.viable ? "Viable" : session.blackout ? "Venue conflict" : "Needs recovery";
        return `<div class="venue-schedule-row"><strong>${humanDate(session.date)}</strong><span>${status}</span><span>${session.playerCount} Player signals</span><label><input type="checkbox" name="series_session" value="${index}" ${checked}> Include</label></div>`;
      }).join("");
    } catch (error) {
      logError("Unable to render sessions", error);
    }
  }

  function selectedSessions(source) {
    try {
      return [...document.querySelectorAll('input[name="series_session"]:checked')].map((input) => source.sessions[Number(input.value)]).filter(Boolean);
    } catch (error) {
      logError("Unable to read selected sessions", error);
      return [];
    }
  }

  function buildSeries(source) {
    try {
      const minPlayers = Number(document.querySelector("#series-min").value);
      const maxPlayers = Number(document.querySelector("#series-max").value);
      if (minPlayers > maxPlayers) throw new Error("Minimum Players cannot exceed maximum seats.");
      return {
        id: `series-${Date.now()}`,
        title: document.querySelector("#series-title").value.trim(),
        type: document.querySelector("#series-type").value,
        system: source.system,
        venue: source.venue,
        commitmentModel: document.querySelector("#commitment-model").value,
        joinMode: document.querySelector("#series-join").value,
        minPlayers,
        maxPlayers,
        status: "forming",
        createdAt: new Date().toISOString(),
        sessions: selectedSessions(source).map((session, index) => ({
          id: `session-${Date.now()}-${index}`,
          date: session.date,
          status: "forming",
          venueApproved: false,
          confirmedPlayers: 0,
          waitlistedPlayers: 0,
          sourceViable: session.viable,
          sourcePlayerSignals: session.playerCount,
          exception: session.viable ? null : "recovery_needed"
        }))
      };
    } catch (error) {
      logError("Unable to build GameSeries", error);
      throw error;
    }
  }

  function renderPreview(series) {
    try {
      const box = document.querySelector("#series-preview");
      if (!box) return;
      box.hidden = false;
      box.innerHTML = `<p class="eyebrow">FORMING SERIES CREATED</p><h2>${series.title}</h2><p>${series.system} · ${series.venue} · ${series.sessions.length} planned sessions</p><p><strong>Commitment model:</strong> ${series.commitmentModel}</p><p><strong>Confirmation rule per session:</strong> venue approved + ${series.minPlayers} confirmed Players.</p><div>${series.sessions.map((session) => `<div class="venue-schedule-row"><strong>${humanDate(session.date)}</strong><span>${session.status}</span><span>0/${series.minPlayers} Players</span><span>${session.exception ? "Recovery needed" : "Ready to form"}</span></div>`).join("")}</div><div class="next-step"><a class="button primary" href="series-commitments.html">Manage Player Commitments</a><a class="button secondary" href="table-lifecycle.html">Manage Session Lifecycle</a><a class="button secondary" href="game-hub.html">Preview Game Hub</a></div>`;
    } catch (error) {
      logError("Unable to render series preview", error);
    }
  }

  function bind() {
    try {
      const source = readSource();
      renderSource(source);
      renderSessions(source);
      const form = document.querySelector("#series-form");
      form?.addEventListener("submit", (event) => {
        event.preventDefault();
        const status = document.querySelector("#series-form-status");
        try {
          if (!source) throw new Error("Choose a recurring match first.");
          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }
          const series = buildSeries(source);
          if (!series.title) throw new Error("Series title is required.");
          if (!series.sessions.length) throw new Error("Include at least one session.");
          localStorage.setItem(STORAGE_KEY, JSON.stringify(series));
          localStorage.removeItem("ddd-series-commitments");
          renderPreview(series);
          if (status) status.textContent = `Forming series created with ${series.sessions.length} session${series.sessions.length === 1 ? "" : "s"}.`;
        } catch (error) {
          logError("Unable to create series", error);
          if (status) status.textContent = error.message || "Unable to create series.";
        }
      });
    } catch (error) {
      logError("Unable to initialize Form Series", error);
    }
  }

  bind();
})();
