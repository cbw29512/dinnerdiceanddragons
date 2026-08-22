(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const log = (message, error) => console.error(`[DDD Venue Verification] ${message}`, error);
  let pendingCount = 0;

  function status(node, message, success = false) {
    node.className = `form-status ${success ? "success-message" : "error-message"}`;
    node.textContent = message;
  }

  function showSignedOut() {
    byId("account-copy").textContent = "You are not signed in.";
    byId("signed-out").hidden = false;
    byId("access-denied").hidden = true;
    byId("verification-content").hidden = true;
  }

  function showDenied(email) {
    byId("account-copy").textContent = `Signed in as ${email}.`;
    byId("signed-out").hidden = true;
    byId("access-denied").hidden = false;
    byId("verification-content").hidden = true;
  }

  function setCount(next) {
    pendingCount = Math.max(0, Number(next) || 0);
    byId("pending-count").textContent = String(pendingCount);
    byId("empty-state").hidden = pendingCount !== 0;
  }

  function fact(label, value) {
    const wrapper = document.createElement("div");
    wrapper.className = "verification-fact";
    const name = document.createElement("span");
    name.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value || "Not provided";
    wrapper.append(name, strong);
    return wrapper;
  }

  function addressText(claim) {
    return [claim.address_line1, claim.address_line2, `${claim.city}, ${claim.state_region} ${claim.postal_code}`]
      .filter(Boolean)
      .join(", ");
  }

  function venueType(value) {
    return String(value || "public_venue").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
  }

  function claimCard(claim) {
    const card = document.createElement("article");
    card.className = "status-panel verification-card";
    card.dataset.venueId = claim.venue_id;

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "PENDING PUBLIC VENUE";
    const heading = document.createElement("h2");
    heading.textContent = claim.name;
    const address = document.createElement("address");
    address.className = "verification-address";
    address.textContent = addressText(claim);

    const facts = document.createElement("div");
    facts.className = "verification-facts";
    facts.append(
      fact("Venue type", venueType(claim.venue_type)),
      fact("Manager role", venueType(claim.manager_role)),
      fact("Manager account", claim.manager_display_name || claim.manager_email),
      fact("Manager email", claim.manager_email),
      fact("Account status", claim.manager_account_status),
      fact("Venue phone", claim.phone || "Not provided")
    );

    const actions = document.createElement("div");
    actions.className = "verification-actions";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button primary";
    button.textContent = "Verify Venue";
    if (claim.manager_account_status !== "active") {
      button.disabled = true;
      button.title = "The claiming manager account must be active before verification.";
    }
    const message = document.createElement("p");
    message.className = "form-status";
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");

    button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        status(message, "Verifying public Venue…", true);
        await window.DDDProductionAPI.verifyVenueClaim(claim.venue_id, claim.venue_manager_id);
        card.remove();
        setCount(pendingCount - 1);
        status(byId("queue-status"), `${claim.name} is verified. Its active table times can now enter matching.`, true);
      } catch (error) {
        log("Unable to verify Venue claim", error);
        button.disabled = false;
        status(message, error?.message || "Venue verification could not be completed.");
      }
    });

    actions.append(button, message);
    card.append(eyebrow, heading, address, facts, actions);
    return card;
  }

  function renderClaims(claims) {
    const list = byId("pending-venue-list");
    list.replaceChildren();
    for (const claim of claims || []) list.append(claimCard(claim));
    setCount((claims || []).length);
  }

  async function init() {
    try {
      await window.DDDProductionAuth.init();
      const session = await window.DDDProductionAuth.getSession();
      if (!session) return showSignedOut();

      const me = await window.DDDProductionAPI.getMe();
      if (!(me?.roles || []).includes("admin")) return showDenied(session.user.email);

      byId("account-copy").textContent = `Signed in as ${session.user.email}.`;
      byId("signed-out").hidden = true;
      byId("access-denied").hidden = true;
      byId("verification-content").hidden = false;
      status(byId("queue-status"), "Loading pending Venue claims…", true);
      const claims = await window.DDDProductionAPI.getPendingVenueClaims();
      renderClaims(claims);
      status(byId("queue-status"), claims.length ? "Review each claim before verifying." : "Verification queue is clear.", true);
    } catch (error) {
      log("Unable to load Venue verification queue", error);
      status(byId("queue-status"), error?.message || "Venue verification queue could not be loaded.");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else void init();
})();
