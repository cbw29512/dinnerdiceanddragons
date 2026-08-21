(() => {
  "use strict";

  let step = 1;
  let authMode = "signup";
  let signedIn = false;
  const params = new URLSearchParams(window.location.search);
  const editVenueId = params.get("edit") || "";
  const addingAnotherVenue = params.get("new") === "1";
  const editMode = Boolean(editVenueId);
  const form = () => document.getElementById("venue-start-form");
  const byId = (id) => document.getElementById(id);
  const log = (message, error) => console.error(`[DDD Venue Start] ${message}`, error);

  function announce(id, message, success = false) {
    const node = byId(id);
    if (!node) return;
    node.className = `form-status ${success ? "success-message" : "error-message"}`;
    node.textContent = message;
  }

  function showStep(next) {
    try {
      step = Math.max(editMode ? 3 : 1, Math.min(5, next));
      document.querySelectorAll(".start-step").forEach((node) => { node.hidden = Number(node.dataset.step) !== step; });
      byId("step-count").textContent = editMode ? `Update ${step - 2} of 3` : `Step ${step} of 5`;
      byId("progress-bar").style.width = editMode ? `${(step - 2) * 33.34}%` : `${step * 20}%`;
      if (step === 5) renderReview();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) { log("Unable to change Venue step", error); }
  }

  function values() {
    const output = {};
    for (const [rawKey, value] of new FormData(form()).entries()) {
      const array = rawKey.endsWith("[]");
      const key = array ? rawKey.slice(0, -2) : rawKey;
      if (array) (output[key] ||= []).push(value); else output[key] = value;
    }
    return output;
  }

  function valid(name, message, statusId) {
    const result = window.DDDHostStartAccount.valid(form(), name, message);
    if (!result.ok) announce(statusId, result.message);
    return result.ok;
  }

  function venueReady() {
    const fields = [["business_name", "Enter the public venue name."], ["address", "Enter the public street address."], ["city", "Enter the city."], ["state", "Enter a two-letter state code."], ["postal_code", "Enter a five-digit ZIP code."]];
    for (const [name, message] of fields) if (!valid(name, message, "venue-details-status")) return false;
    announce("venue-details-status", "Public venue location looks good.", true);
    return true;
  }

  function availabilityReady() {
    if (form().querySelectorAll('[name="availability_day[]"]').length) return true;
    announce("availability-status", "Choose at least one time when this venue can host a game.");
    return false;
  }

  function renderReview() {
    const raw = values();
    const rows = [["Venue", raw.business_name], ["Address", `${raw.address}, ${raw.city}, ${raw.state} ${raw.postal_code}`], ["Available", (raw.availability_day || []).join(", ")], ["Capacity", `${raw.table_count} table(s) · ${raw.seats_per_table} seats each`], ["Status", editMode ? "Replace this Venue calendar" : "Saved now; matching begins after verification"]];
    const review = byId("venue-review");
    review.replaceChildren();
    for (const [label, value] of rows) {
      const row = document.createElement("div"); row.className = "review-row";
      const name = document.createElement("span"); name.textContent = label;
      const strong = document.createElement("strong"); strong.textContent = value;
      row.append(name, strong); review.append(row);
    }
  }

  function showManagedVenues(venues) {
    form().hidden = true;
    document.querySelector(".start-progress").hidden = true;
    const ready = byId("venue-ready"); ready.hidden = false;
    ready.querySelector(".eyebrow").textContent = "YOUR VENUES";
    ready.querySelector("h2").textContent = "Choose a Venue calendar to change.";
    ready.querySelector("p:not(.eyebrow)").textContent = "Your saved table times stay active until you replace them.";
    const list = byId("managed-venue-list"); list.hidden = false;
    window.DDDHostManagedVenues.renderManagedList(list, venues);
    const actions = ready.querySelector(".step-actions");
    if (!actions.querySelector("[data-add-another-venue]")) {
      const add = document.createElement("a"); add.className = "button secondary"; add.href = "host.html?new=1"; add.dataset.addAnotherVenue = "true"; add.textContent = "Add Another Venue"; actions.append(add);
    }
  }

  async function openVenueEdit() {
    const venues = await window.DDDProductionAPI.getManagedVenues();
    const venue = (venues || []).find((item) => item.id === editVenueId);
    if (!venue) throw new Error("That Venue is not managed by this account.");
    const windows = await window.DDDProductionAPI.getVenueTableWindows(editVenueId);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (!window.DDDHostManagedVenues.hydrate(form(), venue, windows)) throw new Error("The saved Venue calendar could not be loaded.");
    byId("venue-review-title").textContent = "Ready to update this Venue calendar?";
    byId("venue-submit").textContent = "Save Calendar";
    byId("conduct-check").checked = true;
    showStep(3);
  }

  async function afterAuth(session) {
    signedIn = true;
    window.DDDHostStartAccount.lockSignedIn(form(), session);
    announce("auth-status", `Signed in as ${session.user.email}.`, true);
    if (editMode) return openVenueEdit();
    if (!addingAnotherVenue) {
      const me = await window.DDDProductionAPI.getMe();
      if ((me?.roles || []).includes("venue_manager")) return showManagedVenues(await window.DDDProductionAPI.getManagedVenues());
    }
    form().elements.contact_name.disabled = false;
    form().elements.contact_name.closest("label").hidden = false;
    if (form().elements.contact_name.value.trim()) return showStep(2);
    announce("auth-status", "Signed in. Add the host or manager name for this venue, then continue.", true);
    form().elements.contact_name.focus();
  }

  async function account() {
    if (signedIn) {
      if (valid("contact_name", "Enter the host or manager name.", "auth-status")) showStep(2);
      return;
    }
    if (authMode === "signup" && !valid("contact_name", "Enter the host or manager name.", "auth-status")) return;
    announce("auth-status", authMode === "signin" ? "Signing in…" : "Creating your account…", true);
    const result = await window.DDDHostStartAccount.authenticate(form(), authMode);
    if (result.error) return announce("auth-status", result.error);
    if (!result.session) return announce("auth-status", "Check your email to confirm the account, then return and sign in.");
    await afterAuth(result.session);
  }

  async function save(event) {
    event.preventDefault();
    try {
      if (!byId("conduct-check").checked) { byId("conduct-check").focus(); return announce("save-status", "Please confirm the Code of Conduct and your authority to offer this venue."); }
      announce("save-status", editMode ? "Updating this Venue calendar…" : "Saving your venue and table availability…", true);
      if (editMode) {
        const timezone = window.DDDProductionOnboarding.browserTimezone();
        await window.DDDProductionAPI.putVenueTableWindows(editVenueId, window.DDDHostManagedVenues.replacementPayload(values(), timezone));
      } else await window.DDDProductionOnboarding.save("Venue", values());
      form().hidden = true; document.querySelector(".start-progress").hidden = true; byId("venue-ready").hidden = false;
      byId("venue-ready").querySelector("h2").textContent = editMode ? "Your Venue calendar is updated." : "Your venue and table times are saved.";
    } catch (error) { log("Unable to save Venue", error); announce("save-status", error?.message || "We could not save this Venue."); }
  }

  async function init() {
    try {
      document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => { authMode = button.dataset.authMode; window.DDDHostStartAccount.setMode(form(), authMode); }));
      document.querySelector('[data-action="account"]').addEventListener("click", () => void account());
      document.querySelectorAll(".back-button").forEach((button) => button.addEventListener("click", () => showStep(step - 1)));
      document.querySelectorAll(".next-button:not([data-action])").forEach((button) => button.addEventListener("click", () => { if (step === 2 && !venueReady()) return; if (step === 3 && !availabilityReady()) return; showStep(step + 1); }));
      form().addEventListener("submit", (event) => void save(event));
      if (params.get("mode") === "signin") { authMode = "signin"; window.DDDHostStartAccount.setMode(form(), authMode); }
      await window.DDDProductionAuth.init();
      const session = await window.DDDProductionAuth.getSession();
      if (session) await afterAuth(session);
    } catch (error) { log("Unable to initialize Venue setup", error); announce("auth-status", error?.message || "Account service is temporarily unavailable."); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else void init();
})();