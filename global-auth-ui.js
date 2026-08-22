(() => {
  "use strict";

  const ROLE_META = Object.freeze({
    player: Object.freeze({
      accountRole: "player",
      destination: "play.html",
      icon: "🎲",
      label: "Player",
      action: "Find a Game"
    }),
    gm: Object.freeze({
      accountRole: "gm",
      destination: "dm.html",
      icon: "🧙",
      label: "DM",
      action: "DM a Game"
    }),
    venue: Object.freeze({
      accountRole: "venue_manager",
      destination: "host.html",
      icon: "🍽️",
      label: "Venue",
      action: "Host Games"
    }),
    admin: Object.freeze({
      accountRole: "admin",
      destination: "admin-venues.html",
      icon: "🛡️",
      label: "Admin",
      action: "Venue Verification"
    })
  });

  const DESTINATIONS = Object.freeze(
    Object.fromEntries(Object.entries(ROLE_META).map(([role, meta]) => [role, meta.destination]))
  );

  function pageRole() {
    const page = String(window.location.pathname || "").split("/").filter(Boolean).pop() || "";
    if (page === "play.html") return "player";
    if (page === "dm.html") return "gm";
    if (page === "host.html") return "venue";
    if (page === "admin-venues.html") return "admin";
    return null;
  }

  let selectedRole = pageRole() || "player";
  let initialized = false;
  let accountRoles = new Set();

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
        type: "button",
        "aria-haspopup": "dialog",
        "aria-controls": "ddd-global-account-dialog",
        "aria-expanded": "false"
      }, "Sign In"));
    } catch (error) {
      log("Unable to build shared header controls", error);
    }
  }

  function roleButtons(dialog) {
    return dialog.querySelector(".ddd-role-picker");
  }

  function ensureDialog() {
    const existing = document.getElementById("ddd-global-account-dialog");
    if (existing) return existing;
    const dialog = el("dialog", { id: "ddd-global-account-dialog", class: "ddd-account-dialog" });
    const shell = el("div", { class: "ddd-account-shell" });
    const close = el("button", { type: "button", class: "ddd-account-close", "aria-label": "Close account panel" }, "×");
    const heading = el("div", { class: "ddd-account-heading" });
    heading.append(
      el("p", { class: "ddd-account-kicker" }, "YOUR DDD ACCOUNT"),
      el("h2", { id: "ddd-account-title" }, "What do you want to do?")
    );
    const roles = el("div", { class: "ddd-role-picker", role: "group", "aria-label": "Choose a DDD role" });
    const status = el("p", { id: "ddd-auth-status", class: "ddd-account-status", role: "status", "aria-live": "polite" });
    const continueLink = el("a", { id: "ddd-continue-role", class: "ddd-continue-role", href: DESTINATIONS.player }, "Continue to Find a Game →");
    const accountLink = el("a", { id: "ddd-account-home", class: "button secondary", href: "signin.html" }, "Sign In");
    shell.append(close, heading, roles, continueLink, accountLink, status);
    dialog.append(shell);
    document.body.append(dialog);
    return dialog;
  }

  function availableRoleEntries(signedIn) {
    const entries = ["player", "gm", "venue"];
    if (signedIn && accountRoles.has("admin")) entries.push("admin");
    return entries;
  }

  function renderRolePicker(signedIn) {
    const dialog = ensureDialog();
    const picker = roleButtons(dialog);
    if (!picker) return;
    picker.replaceChildren();

    const visibleRoles = availableRoleEntries(signedIn);
    if (!visibleRoles.includes(selectedRole)) selectedRole = pageRole() && visibleRoles.includes(pageRole()) ? pageRole() : "player";

    visibleRoles.forEach((role) => {
      const meta = ROLE_META[role];
      const hasRole = accountRoles.has(meta.accountRole);
      const button = el("button", {
        type: "button",
        "data-ddd-role": role,
        "aria-pressed": String(role === selectedRole)
      });
      button.append(
        el("span", { "aria-hidden": "true" }, meta.icon),
        el("strong", {}, meta.label),
        el("small", {}, signedIn ? (hasRole ? "On this account" : "Set up") : meta.action)
      );
      button.addEventListener("click", () => syncRole(role));
      picker.append(button);
    });
  }

  function syncRole(role) {
    selectedRole = DESTINATIONS[role] ? role : "player";
    document.querySelectorAll("[data-ddd-role]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.dddRole === selectedRole));
    });
    const link = document.getElementById("ddd-continue-role");
    if (link) {
      const meta = ROLE_META[selectedRole];
      link.href = meta.destination;
      link.textContent = `Continue to ${meta.action} →`;
    }
  }

  async function loadAccountRoles(signedIn) {
    accountRoles = new Set();
    if (!signedIn || !window.DDDProductionAPI?.getMeOptional) return;
    try {
      const me = await window.DDDProductionAPI.getMeOptional();
      for (const role of Array.isArray(me?.roles) ? me.roles : []) accountRoles.add(String(role));
    } catch (error) {
      log("Unable to load DDD account roles", error);
    }
  }

  async function renderSession(session) {
    const signedIn = Boolean(session?.access_token);
    const trigger = accountButton();
    const home = document.getElementById("ddd-account-home");
    const status = document.getElementById("ddd-auth-status");
    const title = document.getElementById("ddd-account-title");

    await loadAccountRoles(signedIn);
    renderRolePicker(signedIn);
    syncRole(selectedRole);

    const context = pageRole();
    if (trigger) {
      trigger.classList.toggle("is-signed-in", signedIn);
      trigger.textContent = signedIn ? `${context ? ROLE_META[context].label : "My DDD"} ▾` : "Sign In";
      trigger.setAttribute("aria-label", signedIn ? "Switch DDD role or open My DDD" : "Sign in to Dinner, Dice & Dragons");
    }
    if (title) title.textContent = signedIn ? "Switch DDD role" : "What do you want to do?";
    if (home) {
      home.href = signedIn ? "my-ddd.html" : "signin.html";
      home.textContent = signedIn ? "Open My DDD" : "Sign In";
    }
    if (status) {
      status.textContent = signedIn
        ? `Signed in as ${session.user.email}. One account can use more than one DDD role.`
        : "Choose a role to create an account, or sign in to an existing one.";
    }
  }

  function openDialog(dialog) {
    const trigger = accountButton();
    trigger?.setAttribute("aria-expanded", "true");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    accountButton()?.setAttribute("aria-expanded", "false");
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function bind() {
    const dialog = ensureDialog();
    accountButton()?.addEventListener("click", async () => {
      const session = await window.DDDProductionAuth.getSession().catch(() => null);
      await renderSession(session);
      openDialog(dialog);
    });
    dialog.querySelector(".ddd-account-close")?.addEventListener("click", () => closeDialog(dialog));
    dialog.addEventListener("close", () => accountButton()?.setAttribute("aria-expanded", "false"));
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    try {
      ensureHeader();
      bind();
      const session = await window.DDDProductionAuth?.init?.();
      await renderSession(session);
      window.DDDProductionAuth?.onAuthStateChange?.((nextSession) => { void renderSession(nextSession); });
    } catch (error) {
      log("Unable to initialize shared account UI", error);
      await renderSession(null);
    }
  }

  window.DDDGlobalAuthUI = Object.freeze({ init, syncRole });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else void init();
})();