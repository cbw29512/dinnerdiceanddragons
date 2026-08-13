(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function getStatusNode(form) {
    return form.querySelector(".form-status");
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
    return `ddd-preview-${type.toLowerCase().replaceAll(" ", "-")}`;
  }

  function apiAction_(type) {
    if (type === "Player") return "player.save";
    if (type === "Game Master") return "gm.save";
    if (type === "Game") return "game.save";
    return "";
  }

  function saveLocal_(type, values) {
    try {
      localStorage.setItem(localKey_(type), JSON.stringify(values));
    } catch (error) {
      logError("Unable to save local fallback", error);
      throw error;
    }
  }

  async function saveForm_(form) {
    try {
      const type = form.dataset.profileType || "Profile";
      const values = serializeForm(form);
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

      const identity = result.player_id || result.gm_id || result.game_id || "";
      if (identity) localStorage.setItem(`ddd-${type.toLowerCase().replaceAll(" ", "-")}-id`, identity);
      if (result.user_id) localStorage.setItem("ddd-user-id", result.user_id);
      if (status) {
        status.className = "form-status success-message";
        status.textContent = "Saved.";
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
