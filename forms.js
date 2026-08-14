(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function getStatusNode(form) {
    try {
      return form.querySelector(".form-status");
    } catch (error) {
      logError("Unable to find form status node", error);
      return null;
    }
  }

  function validatePostalCode(form) {
    try {
      const postal = form.querySelector('[name="postal_code"]');
      if (!postal) return true;
      if (/^\d{5}$/.test(postal.value.trim())) return true;
      postal.setCustomValidity("Enter a five-digit US ZIP code.");
      postal.reportValidity();
      postal.focus();
      return false;
    } catch (error) {
      logError("Unable to validate ZIP code", error);
      return false;
    }
  }

  function serializeForm(form) {
    try {
      const output = {};
      for (const [rawKey, value] of new FormData(form).entries()) {
        const isArray = rawKey.endsWith("[]");
        const key = isArray ? rawKey.slice(0, -2) : rawKey;
        if (isArray) {
          if (!Array.isArray(output[key])) output[key] = [];
          output[key].push(value);
        } else if (Object.prototype.hasOwnProperty.call(output, key)) {
          output[key] = Array.isArray(output[key]) ? [...output[key], value] : [output[key], value];
        } else {
          output[key] = value;
        }
      }
      return output;
    } catch (error) {
      logError("Unable to serialize form", error);
      throw error;
    }
  }

  function localKey_(type) {
    try {
      return `ddd-preview-${type.toLowerCase().replaceAll(" ", "-")}`;
    } catch (error) {
      logError("Unable to build local preview key", error);
      return "ddd-preview-profile";
    }
  }

  function apiAction_(type) {
    try {
      if (type === "Player") return "player.save";
      if (type === "Game Master") return "gm.save";
      if (type === "Game") return "game.save";
      return "";
    } catch (error) {
      logError("Unable to resolve form API action", error);
      return "";
    }
  }

  function injectKnownIdentity_(type, values) {
    try {
      const userId = localStorage.getItem("ddd-user-id") || "";
      if (userId) values.user_id = userId;

      if (type === "Player") {
        const playerId = localStorage.getItem("ddd-player-id") || "";
        if (playerId) values.player_id = playerId;
      } else if (type === "Game Master") {
        const gmId = localStorage.getItem("ddd-game-master-id") || "";
        if (gmId) values.gm_id = gmId;
      } else if (type === "Game") {
        const gameId = localStorage.getItem("ddd-game-id") || "";
        const gmId = localStorage.getItem("ddd-game-master-id") || "";
        if (gameId) values.game_id = gameId;
        if (gmId) values.gm_id = gmId;
        values.status = "forming";
        const rawMatch = localStorage.getItem("ddd-selected-venue-slot");
        if (rawMatch) {
          const match = JSON.parse(rawMatch);
          if (match.venueId) values.venue_id = match.venueId;
          if (match.matchScore !== undefined) values.match_score = match.matchScore;
          if (match.eligiblePlayers !== undefined) values.compatible_player_count = match.eligiblePlayers;
        }
      }
      return values;
    } catch (error) {
      logError("Unable to reuse saved pilot identity", error);
      return values;
    }
  }

  function saveLocal_(type, values) {
    try {
      localStorage.setItem(localKey_(type), JSON.stringify(values));
    } catch (error) {
      logError("Unable to save local fallback", error);
      throw error;
    }
  }

  function persistReturnedIdentity_(type, result) {
    try {
      const identity = result.player_id || result.gm_id || result.game_id || "";
      if (identity) localStorage.setItem(`ddd-${type.toLowerCase().replaceAll(" ", "-")}-id`, identity);
      if (result.user_id) localStorage.setItem("ddd-user-id", result.user_id);
    } catch (error) {
      logError("Unable to persist returned pilot identity", error);
    }
  }

  async function saveForm_(form) {
    try {
      const type = form.dataset.profileType || "Profile";
      const values = injectKnownIdentity_(type, serializeForm(form));
      saveLocal_(type, values);
      const action = apiAction_(type);
      const status = getStatusNode(form);

      if (!action || !window.DDD_API?.isConfigured()) {
        if (status) {
          status.className = "form-status success-message";
          status.textContent = "Saved. We’ll use this information in your current browser experience.";
        }
        return;
      }

      if (status) status.textContent = "Saving…";
      const result = await window.DDD_API.post(action, values);
      if (!result.ok) throw new Error(result.error || "Save failed");

      persistReturnedIdentity_(type, result);
      if (status) {
        status.className = "form-status success-message";
        status.textContent = "Saved to the shared pilot.";
      }
    } catch (error) {
      logError("Unable to save form", error);
      const status = getStatusNode(form);
      if (status) {
        status.className = "form-status error-message";
        status.textContent = "We couldn’t save online, but your information is still saved on this device.";
      }
    }
  }

  function bindForm(form) {
    try {
      form.addEventListener("input", (event) => {
        if (event.target && typeof event.target.setCustomValidity === "function") event.target.setCustomValidity("");
      });
      form.addEventListener("submit", async (event) => {
        try {
          event.preventDefault();
          if (!validatePostalCode(form)) return;
          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }
          await saveForm_(form);
        } catch (error) {
          logError("Unable to submit form", error);
        }
      });
    } catch (error) {
      logError("Unable to initialize form", error);
    }
  }

  try {
    document.querySelectorAll(".prototype-form").forEach(bindForm);
  } catch (error) {
    logError("Unable to initialize forms", error);
  }
})();
