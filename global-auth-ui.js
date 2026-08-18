(() => {
  "use strict";

  const ROLE_DESTINATIONS = Object.freeze({
    player: "join.html#player",
    gm: "join.html#gm",
    venue: "venues.html#signup"
  });
  const SUPPORT_URL = "https://buymeacoffee.com/divclass016";

  let initialized = false;
  let selectedRole = "player";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function element(tag, attributes = {}, text = "") {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
      if (value === true) node.setAttribute(name, "");
      else if (value !== false && value !== null && value !== undefined) node.setAttribute(name, String(value));
    }
    if (text) node.textContent = text;
    return node;
  }

  function ensureSupportFooter() {
    const footer = document.querySelector("footer");
    if (!footer || footer.querySelector(".ddd-support-footer")) return;

    const support = element("div", { class: "ddd-support-footer" });
    const message = element(
      "span",
      {},
      "Want to help keep Dinner, Dice & Dragons running? Contributions help cover the time, effort, and costs of operating the site."
    );
    const link = element(
      "a",
      {
        href: SUPPORT_URL,
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": "Support Dinner, Dice & Dragons on Buy Me a Coffee (opens in a new tab)"
      },
      "☕ Support DD&D"
    );
    support.append(message, link);

    const footerShell = footer.querySelector(".shell") || footer;
    footerShell.append(support);
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

  function roleButton(role, icon, label, detail, pressed) {
    const button = element("button", {
      type: "button",
      "data-ddd-role": role,
      "aria-pressed": String(pressed)
    });
    button.append(
      element("span", { "aria-hidden": "true" }, icon),
      element("strong", {}, label),
      element("small", {}, detail)
    );
    return button;
  }

  function labeledInput(labelText, inputAttributes) {
    const label = element("label");
    label.append(document.createTextNode(labelText), element("input", inputAttributes));
    return label;
  }

  function ensureDialogMarkup() {
    if (dialog()) return dialog();

    const panel = element("dialog", {
      id: "ddd-global-account-dialog",
      class: "ddd-account-dialog",
      "aria-labelledby": "ddd-account-title"
    });
    const shell = element("div", { class: "ddd-account-shell" });
    const close = element(
      "button",
      { class: "ddd-account-close", type: "button", "aria-label": "Close account panel" },
      "×"
    );
    const heading = element("div", { class: "ddd-account-heading" });
    heading.append(
      element("p", { class: "ddd-account-kicker" }, "YOUR DDD ACCOUNT"),
      element("h2", { id: "ddd-account-title" }, "One login. Every way you play."),
      element(
        "p",
        {},
        "Use the same account as a Player, DM, or Venue manager. Pick what you want to do and we keep you on that path."
      )
    );

    const rolePicker = element("div", {
      class: "ddd-role-picker",
      role: "group",
      "aria-label": "Choose what you want to do"
    });
    rolePicker.append(
      roleButton("player", "🎲", "Player", "Find a table", true),
      roleButton("gm", "🧙", "DM", "Run a game", false),
      roleButton("venue", "🍽️", "Venue", "Host tables", false)
    );

    const form = element("form", { id: "ddd-auth-form", class: "ddd-auth-form" });
    form.append(
      labeledInput("Email address", {
        id: "ddd-auth-email",
        type: "email",
        autocomplete: "email",
        required: true
      }),
      labeledInput("Password", {
        id: "ddd-auth-password",
        type: "password",
        autocomplete: "current-password",
        minlength: "8",
        required: true
      })
    );

    const authActions = element("div", { class: "ddd-auth-actions" });
    authActions.append(
      element("button", { class: "button primary", id: "ddd-sign-in", type: "submit" }, "Sign In"),
      element("button", { class: "button secondary", id: "ddd-create-account", type: "button" }, "Create Account"),
      element("button", { class: "button secondary", id: "ddd-sign-out", type: "button", hidden: true }, "Sign Out")
    );
    form.append(
      authActions,
      element(
        "p",
        { class: "ddd-account-status", id: "ddd-auth-status", role: "status", "aria-live": "polite" },
        "Sign in or create an account to continue."
      )
    );

    const continueRole = element(
      "a",
      { class: "ddd-continue-role", id: "ddd-continue-role", href: ROLE_DESTINATIONS.player },
      "Continue as Player →"
    );
    const footnote = element(
      "p",
      { class: "ddd-account-footnote" },
      "Your account can hold multiple roles. Choosing one here does not remove your other roles."
    );

    shell.append(close, heading, rolePicker, form, continueRole, footnote);
    panel.append(shell);
    document.body.append(panel);
    return panel;
  }

  function ensureHeaderControls() {
    if (accountButton()) return;
    const nav = document.querySelector("header .nav-right, .site-header nav, header nav");
    if (!nav) return;

    nav.querySelectorAll('[data-ddd-legacy-role-link="true"]').forEach((node) => node.remove());
    const roleGroup = element("div", { class: "ddd-header-role-links", "aria-label": "Start by role" });
    for (const [role, label] of [["player", "Find a Game"], ["gm", "Run a Game"], ["venue", "For Venues"]]) {
      roleGroup.append(element("a", { href: ROLE_DESTINATIONS[role], "data-ddd-role-link": role }, label));
    }

    const button = element("button", {
      id: "ddd-global-account-button",
      class: "ddd-account-trigger",
      type: "button",
      "aria-haspopup": "dialog",
      "aria-controls": "ddd-global-account-dialog"
    }, "Sign In");
    nav.prepend(roleGroup);
    nav.append(button);
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
    ensureSupportFooter();
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
