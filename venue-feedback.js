(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  try {
    const form = document.querySelector("#venue-feedback-form");
    const status = document.querySelector("#venue-feedback-status");
    if (!form) return;

    form.addEventListener("submit", (event) => {
      try {
        event.preventDefault();
        if (!form.checkValidity()) {
          form.reportValidity();
          if (status) status.textContent = "Complete the required venue feedback fields first.";
          return;
        }

        const data = Object.fromEntries(new FormData(form).entries());
        localStorage.setItem("ddd-preview-venue-feedback", JSON.stringify(data));
        if (status) {
          status.className = "form-status success-message";
          status.textContent = "Verified venue feedback preview saved locally. Production will require completed-event eligibility and prevent duplicate submissions.";
        }
      } catch (error) {
        logError("Unable to submit venue feedback preview", error);
        if (status) {
          status.className = "form-status error-message";
          status.textContent = "Unable to save this feedback preview.";
        }
      }
    });
  } catch (error) {
    logError("Unable to initialize venue feedback", error);
  }
})();
