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

  function commitmentLabel(value) {
    try {
      return ({ whole:"Whole campaign", session:"Individual game nights", hybrid:"Core party + open seats" })[value] || value;
    } catch (error) {
      logError("Unable to label commitment model", error);
      return value;
    }
  }

  function renderSource(source) {
    try {
      const box = document.querySelector("#series-source");
      if (!box || !source) return;
      box.innerHTML = `<p class="eyebrow">YOUR CHECKED SCHEDULE</p><h2>${source.system} · ${source.venue}</h2><p>${source.patternSummary} · ${source.viableCount}/${source.sessions.length} dates currently look good · ${source.compatiblePlayers} potential Player${source.compatiblePlayers === 1 ? "" : "s"}</p><a class="button secondary" href="recurring-match.html">Change Schedule</a>`;
      document.querySelector("#series-system-name").value = source.system;
      document.querySelector("#series-venue-name").value = source.venue;
    } catch (error) {
      logError("Unable to render series source", error);
    }
  }

  function sessionStatus(session) {
    try {
      if (session.exception === "skip") return "Skipped";
      if (session.exception === "move_requested") return "Move this date";
      if (session.viable) return "Looks good";
      return session.blackout ? "Venue unavailable" : "Needs attention";
    } catch (error) {
      logError("Unable to label series session", error);
      return "Needs review";
    }
  }

  function renderSessions(source) {
    try {
      const list = document.querySelector("#series-session-list");
      if (!list) return;
      if (!source?.sessions?.length) {
        list.innerHTML = '<p>No game dates are available yet. Go back and check a recurring schedule first.</p>';
        return;
      }
      list.innerHTML = source.sessions.map((session, index) => {
        const checked = session.viable && !session.exception ? "checked" : "";
        return `<div class="venue-schedule-row"><strong>${humanDate(session.date)}</strong><span>${sessionStatus(session)}</span><span>${session.playerCount} potential Player${session.playerCount === 1 ? "" : "s"}</span><label><input type="checkbox" name="series_session" value="${index}" ${checked}> Include this game night</label></div>`;
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
          exception: session.exception || (session.viable ? null : "recovery_needed")
        }))
      };
    } catch (error) {
      logError("Unable to build recurring table", error);
      throw error;
    }
  }

  function renderPreview(series) {
    try {
      const box = document.querySelector("#series-preview");
      if (!box) return;
      box.hidden = false;
      box.innerHTML = `<p class="eyebrow">RECURRING TABLE CREATED</p><h2>${series.title}</h2><p>${series.system} · ${series.venue} · ${series.sessions.length} planned game night${series.sessions.length === 1 ? "" : "s"}</p><p><strong>Player commitment:</strong> ${commitmentLabel(series.commitmentModel)}</p><p><strong>Each game night confirms when:</strong> the venue approves + ${series.minPlayers} Players are confirmed.</p><div>${series.sessions.map((session) => `<div class="venue-schedule-row"><strong>${humanDate(session.date)}</strong><span>Forming</span><span>0/${series.minPlayers} Players</span><span>${session.exception ? "Needs attention before play" : "Ready for commitments"}</span></div>`).join("")}</div><div class="next-step"><strong>Next:</strong><a class="button primary" href="series-commitments.html">Review Players & Venue</a><a class="button secondary" href="table-lifecycle.html?role=gm">Manage a Game Night</a><a class="button secondary" href="game-hub.html?role=gm">See Game Hub</a></div>`;
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
          if (!source) throw new Error("Check a recurring schedule first.");
          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }
          const series = buildSeries(source);
          if (!series.title) throw new Error("Give your recurring game a title.");
          if (!series.sessions.length) throw new Error("Include at least one game night.");
          localStorage.setItem(STORAGE_KEY, JSON.stringify(series));
          localStorage.removeItem("ddd-series-commitments");
          renderPreview(series);
          if (status) status.textContent = `Recurring table created with ${series.sessions.length} game night${series.sessions.length === 1 ? "" : "s"}. Review Players and venue approval next.`;
        } catch (error) {
          logError("Unable to create series", error);
          if (status) status.textContent = error.message || "We couldn’t create that recurring table.";
        }
      });
    } catch (error) {
      logError("Unable to initialize recurring table setup", error);
    }
  }

  bind();
})();