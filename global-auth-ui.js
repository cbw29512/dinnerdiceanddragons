(() => {
  "use strict";

  const DESTINATIONS = Object.freeze({
    player: "play.html",
    gm: "dm.html",
    venue: "host.html"
  });
  let selectedRole = "player";
  let initialized = false;

  function log(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function el(tag, attrs = {}, text = "") {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([name, value]) => {
      if (value === true) node.setAttribute(name, "");
      else if (value !== false && value != null) node.setAttribute(name, String(value));
    });
    if (text) node.textContent = text;
    return node;
  }

  function accountButton() {
    return document.getElementById("ddd-global-account-button");
  }

  function ensureHeader() {
    try {
      if (accountButton()) return;
      const nav = document.querySelector("header .nav-right, .site-header nav, header nav");
      if (!nav) return;
      const roles = el("div", { class: "ddd-header-role-links", "aria-label": "Start by role" });
      [["player", "Find a Game"], ["gm", "Run a Game"], ["venue", "For Venues"]].forEach(([role, label]) => {
        roles.append(el("a", { href: DESTINATIONS[role], "data-ddd-role-link": role }, label));
      });
      nav.prepend(roles);
      nav.append(el("button", {
        id: "ddd-global-account-button",
        class: "ddd-account-trigger",
        type: "button"
      }, "Sign In"));
    } catch (error) {
      log("Unable to build shared header controls", error);
    }
  }

  function ensureDialog() {
    const existing = document.getElementById("ddd-global-account-dialog");
    if (existing) return existing;
    const dialog = el("dialog", { id: "ddd-global-account-dialog", class: "ddd-account-dialog" });
    const shell = el("div", { class: "ddd-account-shell" });
    const close = el("button", { type: "button", class: "ddd-account-close", "aria-label": "Close account panel" }, "×");
    const heading = el("div", { class: "ddd-account-heading" });
    heading.append(el("p", { class: "ddd-account-kicker" }, "YOUR DDD ACCOUNT"), el("h2", {}, "What do you want to do?"));
    const roles = el("div", { class: "ddd-role-picker", role: "group", "aria-label": "Choose a role" });
    [["player", "🎲", "Find a Game"], ["gm", "🧙", "DM a Game"], ["venue", "🍽️", "Host Games"]].forEach(([role, icon, label]) => {
      const button = el("button", { type: "button", "data-ddd-role": role, "aria-pressed": role === selectedRole }, "");
      button.append(el("span", { "aria-hidden": "true" }, icon), el("strong", {}, label));
      roles.append(button);
    });
    const status = el("p", { id: "ddd-auth-status", class: "ddd-account-status", role: "status", "aria-live": "polite" });
    const continueLink = el("a", { id: "ddd-continue-role", class: "ddd-continue-role", href: DESTINATIONS.player }, "Continue to Find a Game →");
    const accountLink = el("a", { id: "ddd-account-home", class: "button secondary", href: "signin.html" }, "Sign In");
    shell.append(close, heading, roles, continueLink, accountLink, status);
    dialog.append(shell);
    document.body.append(dialog);
    return dialog;
  }

  function syncRole(role) {
    selectedRole = DESTINATIONS[role] ? role : "player";
    document.querySelectorAll("[data-ddd-role]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.dddRole === selectedRole));
    });
    const link = document.getElementById("ddd-continue-role");
    if (link) {
      link.href = DESTINATIONS[selectedRole];
      link.textContent = selectedRole === "gm" ? "Continue to DM a Game →" : selectedRole === "venue" ? "Continue to Host Games →" : "Continue to Find a Game →";
    }
  }

  function renderSession(session) {
    const signedIn = Boolean(session?.access_token);
    const trigger = accountButton();
    const home = document.getElementById("ddd-account-home");
    const status = document.getElementById("ddd-auth-status");
    if (trigger) trigger.textContent = signedIn ? "My DDD" : "Sign In";
    if (home) {
      home.href = signedIn ? "my-ddd.html" : "signin.html";
      home.textContent = signedIn ? "Open My DDD" : "Sign In";
    }
    if (status) status.textContent = signedIn ? `Signed in as ${session.user.email}.` : "Choose a role to create an account, or sign in to an existing one.";
  }

  function bind() {
    const dialog = ensureDialog();
    accountButton()?.addEventListener("click", async () => {
      const session = await window.DDDProductionAuth.getSession().catch(() => null);
      if (session) return window.location.assign("my-ddd.html");
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });
    dialog.querySelector(".ddd-account-close")?.addEventListener("click", () => dialog.close());
    dialog.querySelectorAll("[data-ddd-role]").forEach((button) => button.addEventListener("click", () => syncRole(button.dataset.dddRole)));
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    try {
      ensureHeader();
      bind();
      syncRole(selectedRole);
      const session = await window.DDDProductionAuth?.init?.();
      renderSession(session);
      window.DDDProductionAuth?.onAuthStateChange?.(renderSession);
    } catch (error) {
      log("Unable to initialize shared account UI", error);
      renderSession(null);
    }
  }

  window.DDDGlobalAuthUI = Object.freeze({ init, syncRole });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else void init();
})();