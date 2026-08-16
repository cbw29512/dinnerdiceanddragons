(() => {
  "use strict";

  const ROLE_DESTINATIONS = Object.freeze({
    player: "join.html#player",
    gm: "join.html#gm",
    venue: "venues.html#signup"
  });

  let initialized = false;
  let selectedRole = "player";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function roleLabel(role) {
    return role === "gm" ? "DM" : role === "venue" ? "Venue" : "Player";
  }

  function accountButton() {
    return document.getElementById("ddd-global-account-button");
  }

  function dialog() {
    return document.getElementById("ddd-global-account-dialog");
  }

  function statusNode() {
    return document.getElementById("ddd-auth-status");
  }

  function announce(message, success = false) {
    const node = statusNode();
    if (!node) return;
    node.className = `ddd-account-status${success ? " is-success" : ""}`;
    node.textContent = message;
  }

  function setBusy(busy) {
    document.querySelectorAll("#ddd-auth-form input, #ddd-auth-form button").forEach((node) => {
      node.disabled = Boolean(busy);
    });
  }

  function ensureDialogMarkup() {
    if (dialog()) return dialog();

    const markup = document.createElement("dialog");
    markup.id = "ddd-global-account-dialog";
    markup.className = "ddd-account-dialog";
    markup.setAttribute("aria-labelledby", "ddd-account-title");
    markup.innerHTML = `
      <div class="ddd-account-shell">
        <button class="ddd-account-close" type="button" aria-label="Close account panel">×</button>
        <div class="ddd-account-heading">
          <p class="ddd-account-kicker">YOUR DDD ACCOUNT</p>
          <h2 id="ddd-account-title">One login. Every way you play.</h2>
          <p>Use the same account as a Player, DM, or Venue manager. Pick what you want to do and we keep you on that path.</p>
        </div>
        <div class="ddd-role-picker" aria-label="Choose what you want to do">
          <button type="button" data-ddd-role="player" aria-pressed="true"><span aria-hidden="true">🎲</span><strong>Player</strong><small>Find a table</small></button>
          <button type="button" data-ddd-role="gm" aria-pressed="false"><span aria-hidden="true">🧙</span><strong>DM</strong><small>Run a game</small></button>
          <button type="button" data-ddd-role="venue" aria-pressed="false"><span aria-hidden="true">🍽️</span><strong>Venue</strong><small>Host tables</small></button>
        </div>
        <form id="ddd-auth-form" class="ddd-auth-form">
          <label>Email address<input id="ddd-auth-email" type="email" autocomplete="email" required></label>
          <label>Password<input id="ddd-auth-password" type="password" autocomplete="current-password" minlength="8" required></label>
          <div class="ddd-auth-actions">
            <button class="button primary" id="ddd-sign-in" type="submit">Sign In</button>
            <button class="button secondary" id="ddd-create-account" type="button">Create Account</button>
            <button class="button secondary" id="ddd-sign-out" type="button" hidden>Sign Out</button>
          </div>
          <p class="ddd-account-status" id="ddd-auth-status" role="status" aria-live="polite">Sign in or create an account to continue.</p>
        </form>
        <a class="ddd-continue-role" id="ddd-continue-role" href="join.html#player">Continue as Player →</a>
        <p class="ddd-account-footnote">Your account can hold multiple roles. Choosing one here does not remove your other roles.</p>
      </div>`;
    document.body.appendChild(markup);
    return markup;
  }

  function ensureHeaderControls() {
    if (accountButton()) return;
    const nav = document.querySelector("header .nav-right, .site-header nav, header nav");
    if (!nav) return;

    nav.querySelectorAll('[data-ddd-legacy-role-link="true"]').forEach((node) => node.remove());

    const roleGroup = document.createElement("div");
    roleGroup.className = "ddd-header-role-links";
    roleGroup.setAttribute("aria-label", "Start by role");
    roleGroup.innerHTML = `
      <a href="${ROLE_DESTINATIONS.player}" data-ddd-role-link="player">Find a Game</a>
      <a href="${ROLE_DESTINATIONS.gm}" data-ddd-role-link="gm">Run a Game</a>
      <a href="${ROLE_DESTINATIONS.venue}" data-ddd-role-link="venue">For Venues</a>`;

    const button = document.createElement("button");
    button.id = "ddd-global-account-button";
    button.className = "ddd-account-trigger";
    button.type = "button";
    button.textContent = "Sign In";
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", "ddd-global-account-dialog");

    nav.prepend(roleGroup);
    nav.appendChild(button);
  }

  function syncRole(role) {
    selectedRole = ROLE_DESTINATIONS[role] ? role : "player";
    document.querySelectorAll("[data-ddd-role]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.dddRole === selectedRole));
    });
    const link = document.getElementById("ddd-continue-role");
    if (link) {
      link.href = ROLE_DESTINATIONS[selectedRole];
      link.textContent = `Continue as ${roleLabel(selectedRole)} →`;
    }
  }

  function syncProfileEmails(session) {
    const email = session?.user?.email || "";
    const signedIn = Boolean(session?.access_token);
    document.querySelectorAll('#player-form [name="email"], #gm-form [name="email"], #venue-form [name="email"]').forEach((input) => {
      if (signedIn) input.value = email;
      input.readOnly = signedIn;
    });
  }

  function renderSession(session, message = "") {
    const emailInput = document.getElementById("ddd-auth-email");
    const passwordInput = document.getElementById("ddd-auth-password");
    const signIn = document.getElementById("ddd-sign-in");
    const create = document.getElementById("ddd-create-account");
    const signOut = document.getElementById("ddd-sign-out");
    const trigger = accountButton();
    const signedIn = Boolean(session?.access_token);
    const email = session?.user?.email || "";

    if (emailInput) {
      emailInput.disabled = signedIn;
      if (signedIn) emailInput.value = email;
    }
    if (passwordInput) {
      passwordInput.disabled = signedIn;
      if (signedIn) passwordInput.value = "";
    }
    if (signIn) signIn.hidden = signedIn;
    if (create) create.hidden = signedIn;
    if (signOut) signOut.hidden = !signedIn;
    if (trigger) {
      trigger.textContent = signedIn ? "My Account" : "Sign In";
      trigger.classList.toggle("is-signed-in", signedIn);
    }

    syncProfileEmails(session);
    if (message) announce(message, signedIn);
    else if (signedIn) announce(`Signed in as ${email}. Choose Player, DM, or Venue to continue.`, true);
    else announce("Sign in or create an account to continue.");
  }

  async function ensureIdentity() {
    try {
      const session = await window.DDDProductionAuth.getSession();
      if (!session) return null;
      return await window.DDDProductionAPI.getMe();
    } catch (error) {
      logError("Unable to establish DDD identity", error);
      return null;
    }
  }

  async function handleSignIn(event) {
    event.preventDefault();
    const email = document.getElementById("ddd-auth-email")?.value || "";
    const password = document.getElementById("ddd-auth-password")?.value || "";
    setBusy(true);
    announce("Signing in…");
    try {
      const session = await window.DDDProductionAuth.signIn(email, password);
      await ensureIdentity();
      renderSession(session);
    } catch (error) {
      renderSession(null, error?.message || "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAccount() {
    const email = document.getElementById("ddd-auth-email")?.value || "";
    const password = document.getElementById("ddd-auth-password")?.value || "";
    if (!email || !password) {
      announce("Enter an email address and password first.");
      return;
    }

    setBusy(true);
    announce("Creating your account…");
    try {
      const result = await window.DDDProductionAuth.signUp(email, password);
      if (result.session) {
        await ensureIdentity();
        renderSession(result.session, `Account created and signed in as ${result.session.user?.email || email}.`);
      } else {
        renderSession(null, "Account created. Check your email to confirm it, then return and sign in.");
      }
    } catch (error) {
      renderSession(null, error?.message || "Account creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await window.DDDProductionAuth.signOut();
      renderSession(null, "Signed out.");
    } finally {
      setBusy(false);
    }
  }

  function openAccount(role = selectedRole) {
    syncRole(role);
    const panel = ensureDialogMarkup();
    if (typeof panel.showModal === "function") panel.showModal();
    else panel.setAttribute("open", "");
  }

  function bindUi() {
    ensureHeaderControls();
    const panel = ensureDialogMarkup();

    accountButton()?.addEventListener("click", () => openAccount(selectedRole));
    panel.querySelector(".ddd-account-close")?.addEventListener("click", () => panel.close());
    panel.addEventListener("click", (event) => {
      if (event.target === panel) panel.close();
    });
    panel.querySelectorAll("[data-ddd-role]").forEach((button) => {
      button.addEventListener("click", () => syncRole(button.dataset.dddRole));
    });
    document.querySelectorAll("[data-ddd-role-link]").forEach((link) => {
      link.addEventListener("click", () => {
        try { sessionStorage.setItem("ddd-role-intent", link.dataset.dddRole || "player"); } catch {}
      });
    });

    document.getElementById("ddd-auth-form")?.addEventListener("submit", handleSignIn);
    document.getElementById("ddd-create-account")?.addEventListener("click", handleCreateAccount);
    document.getElementById("ddd-sign-out")?.addEventListener("click", handleSignOut);
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    if (!window.DDDProductionAuth || !window.DDDProductionAPI) {
      logError("Global account UI requires production auth and API clients", new Error("Missing dependency"));
      return;
    }

    try {
      const storedIntent = sessionStorage.getItem("ddd-role-intent");
      if (storedIntent && ROLE_DESTINATIONS[storedIntent]) selectedRole = storedIntent;
    } catch {}

    bindUi();
    syncRole(selectedRole);
    window.DDDProductionAuth.onAuthStateChange((session) => renderSession(session));

    try {
      const session = await window.DDDProductionAuth.init();
      if (session) await ensureIdentity();
      renderSession(session);
    } catch (error) {
      renderSession(null, error?.message || "Account sign-in is temporarily unavailable.");
    }
  }

  window.DDDGlobalAuthUI = Object.freeze({ init, openAccount, syncRole });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
