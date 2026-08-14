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

  function fieldLabel(field) {
    try {
      const wrappingLabel = field.closest("label");
      if (wrappingLabel) {
        const text = Array.from(wrappingLabel.childNodes)
          .filter((node) => node !== field)
          .map((node) => node.textContent || "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (text) return text;
      }

      if (field.id) {
        const explicitLabel = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
        if (explicitLabel?.textContent?.trim()) return explicitLabel.textContent.trim();
      }

      return field.getAttribute("aria-label") || field.name || "this field";
    } catch (error) {
      logError("Unable to resolve field label", error);
      return field.name || "this field";
    }
  }

  function formFields(form) {
    try {
      return Array.from(form.elements).filter((field) => {
        if (!(field instanceof HTMLElement)) return false;
        if (field.matches('button, [type="submit"], [type="reset"]')) return false;
        return !field.disabled && typeof field.checkValidity === "function";
      });
    } catch (error) {
      logError("Unable to collect form fields", error);
      return [];
    }
  }

  function clearValidationState(form) {
    try {
      formFields(form).forEach((field) => field.removeAttribute("aria-invalid"));
    } catch (error) {
      logError("Unable to clear form validation state", error);
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

  function announceInvalidForm(form) {
    try {
      const invalidFields = formFields(form).filter((field) => !field.checkValidity());
      invalidFields.forEach((field) => field.setAttribute("aria-invalid", "true"));

      const firstInvalid = invalidFields[0];
      if (!firstInvalid) return false;

      const count = invalidFields.length;
      const fieldName = fieldLabel(firstInvalid);
      announce(
        statusNode(form),
        `Please review ${count} ${count === 1 ? "field" : "fields"}. Start with ${fieldName}.`,
        false,
      );

      firstInvalid.focus();
      if (typeof firstInvalid.reportValidity === "function") firstInvalid.reportValidity();
      return true;
    } catch (error) {
      logError("Unable to announce invalid form", error);
      return false;
    }
  }

  function validatePostalCode(form) {
    try {
      const postal = form.querySelector('[name="postal_code"]');
      if (!postal) return true;

      const valid = /^\d{5}$/.test(postal.value.trim());
      postal.setCustomValidity(valid ? "" : "Enter a five-digit US ZIP code.");
      return valid;
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

  function updateFieldValidity(field) {
    try {
      if (!field || typeof field.setCustomValidity !== "function") return;
      field.setCustomValidity("");
      if (field.checkValidity()) field.removeAttribute("aria-invalid");
    } catch (error) {
      logError("Unable to update field validation state", error);
    }
  }

  function bindForm(form) {
    try {
      form.addEventListener("input", (event) => updateFieldValidity(event.target));
      form.addEventListener("change", (event) => updateFieldValidity(event.target));

      form.addEventListener("submit", async (event) => {
        try {
          event.preventDefault();
          clearValidationState(form);
          validatePostalCode(form);

          if (!form.checkValidity()) {
            announceInvalidForm(form);
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
