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
      const formData = new FormData(form);
      for (const [rawKey, value] of formData.entries()) {
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

  function savePrototype(form) {
    try {
      const type = form.dataset.profileType || "Profile";
      const values = serializeForm(form);
      localStorage.setItem(`ddd-preview-${type.toLowerCase().replaceAll(" ", "-")}`, JSON.stringify(values));
      const status = getStatusNode(form);
      if (status) {
        status.className = "form-status success-message";
        status.textContent = `${type} preview saved on this device. You can continue exploring the prototype.`;
      }
    } catch (error) {
      logError("Unable to save prototype form", error);
      const status = getStatusNode(form);
      if (status) {
        status.className = "form-status error-message";
        status.textContent = "We could not save this preview on your device. Your information was not sent anywhere.";
      }
    }
  }

  function bindForm(form) {
    try {
      form.addEventListener("input", (event) => {
        if (event.target && typeof event.target.setCustomValidity === "function") {
          event.target.setCustomValidity("");
        }
      });

      form.addEventListener("submit", (event) => {
        try {
          event.preventDefault();
          if (!validatePostalCode(form)) return;
          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }
          savePrototype(form);
        } catch (error) {
          logError("Unable to submit prototype form", error);
        }
      });
    } catch (error) {
      logError("Unable to initialize prototype form", error);
    }
  }

  try {
    document.querySelectorAll(".prototype-form").forEach(bindForm);
  } catch (error) {
    logError("Unable to initialize signup forms", error);
  }
})();
