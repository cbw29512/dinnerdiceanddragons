(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function statusNode(form) {
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
      if (!postal || /^\d{5}$/.test(postal.value.trim())) return true;
      postal.setCustomValidity("Enter a five-digit US ZIP code.");
      postal.reportValidity();
      postal.focus();
      return false;
    } catch (error) {
      logError("Unable to validate ZIP code", error);
      return false;
    }
  }

  function serialize(form) {
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

  function saveLocal(type, values) {
    try {
      const key = `ddd-preview-${type.toLowerCase().replaceAll(" ", "-")}`;
      localStorage.setItem(key, JSON.stringify(values));
    } catch (error) {
      logError("Unable to save local form fallback", error);
      throw error;
    }
  }

  function announce(node, message, success) {
    try {
      if (!node) return;
      node.className = `form-status ${success ? "success-message" : "error-message"}`;
      node.textContent = message;
    } catch (error) {
      logError("Unable to announce form state", error);
    }
  }

  async function saveForm(form) {
    try {
      const type = form.dataset.profileType || "Profile";
      const values = window.DDDFormPilot?.injectIdentity(type, serialize(form)) || serialize(form);
      saveLocal(type, values);
      const status = statusNode(form);

      if (!window.DDDFormPilot?.actionFor(type) || !window.DDD_API?.isConfigured()) {
        announce(status, "Saved on this device. You can continue with the next step below.", true);
        form.dispatchEvent(new CustomEvent("ddd:save-success", { detail:{ type, shared:false, result:null, values } }));
        return;
      }

      if (status) status.textContent = "Saving…";
      const saved = await window.DDDFormPilot.save(type, values);
      announce(status, "Saved. Your information is now available to the matching flow.", true);
      form.dispatchEvent(new CustomEvent("ddd:save-success", { detail:{ type, shared:saved.shared, result:saved.result, values } }));
    } catch (error) {
      logError("Unable to save form", error);
      announce(statusNode(form), "We couldn’t save online, but your information is still saved on this device.", false);
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
          await saveForm(form);
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