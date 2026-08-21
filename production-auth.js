(() => {
  "use strict";

  const listeners = new Set();
  let redirectConsumed = false;
  let confirmationCompleted = false;
  let validatedConfig = null;
  let cachedSession = null;

  class ProductionAuthError extends Error {
    constructor(message, status = 0, detail = null) {
      super(message);
      this.name = "ProductionAuthError";
      this.status = status;
      this.detail = detail;
    }
  }

  function productionConfig() {
    if (validatedConfig) return validatedConfig;
    const config = window.DDDProductionConfig;
    if (!config) throw new ProductionAuthError("Production browser configuration is unavailable.");
    try {
      const api = new URL(String(config.apiBaseUrl || window.location.origin));
      if (api.protocol !== "https:" && api.hostname !== "localhost" && api.hostname !== "127.0.0.1") {
        throw new Error("Production API must use HTTPS.");
      }
      validatedConfig = Object.freeze({ apiBaseUrl: api.origin });
      return validatedConfig;
    } catch (error) {
      throw new ProductionAuthError("Production browser configuration is invalid.", 0, error);
    }
  }

  function notify(session) {
    listeners.forEach((listener) => {
      try { listener(session); } catch {}
    });
  }

  function browserSession(user) {
    if (!user?.id || !user?.email) return null;
    return {
      access_token: "netlify-identity-cookie",
      user: { id: user.id, email: user.email }
    };
  }

  function sessionUser(session) {
    return session?.user || null;
  }

  async function authRequest(path, { method = "GET", body = null } = {}) {
    const { apiBaseUrl } = productionConfig();
    let response;
    try {
      response = await fetch(`${apiBaseUrl}/api/v1/auth/${path}`, {
        method,
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          ...(body === null ? {} : { "Content-Type": "application/json" })
        },
        ...(body === null ? {} : { body: JSON.stringify(body) })
      });
    } catch (error) {
      throw new ProductionAuthError("Authentication service is temporarily unreachable.", 0, error);
    }

    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); }
      catch { throw new ProductionAuthError("Authentication service returned an invalid response.", response.status); }
    }
    if (!response.ok) {
      const message = payload?.detail || payload?.error || "Authentication request failed.";
      throw new ProductionAuthError(typeof message === "string" ? message : "Authentication request failed.", response.status, payload);
    }
    return payload;
  }

  async function consumeRedirectSession() {
    if (redirectConsumed) return confirmationCompleted;
    redirectConsumed = true;

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    if (!hash) return false;
    const params = new URLSearchParams(hash);
    const confirmationToken = params.get("confirmation_token");
    if (!confirmationToken) return false;

    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    try {
      await authRequest("confirm", { method: "POST", body: { token: confirmationToken } });
      confirmationCompleted = true;
      cachedSession = null;
      notify(null);
      return true;
    } catch (error) {
      confirmationCompleted = false;
      cachedSession = null;
      notify(null);
      throw error;
    }
  }

  async function fetchSession() {
    const payload = await authRequest("session");
    cachedSession = payload?.authenticated ? browserSession(payload) : null;
    return cachedSession;
  }

  async function getSession() {
    if (await consumeRedirectSession()) return null;
    return fetchSession();
  }

  async function getAccessToken() {
    return "";
  }

  async function signIn(email, password) {
    await authRequest("login", {
      method: "POST",
      body: { email: String(email || "").trim(), password: String(password || "") }
    });
    const session = await fetchSession();
    if (!session) throw new ProductionAuthError("Sign in completed but no Identity session was established.", 401);
    notify(session);
    return session;
  }

  async function signUp(email, password) {
    const payload = await authRequest("signup", {
      method: "POST",
      body: { email: String(email || "").trim(), password: String(password || "") }
    });
    const session = await fetchSession();
    if (session) notify(session);
    return {
      session,
      user: session?.user || { email: payload?.email || String(email || "").trim() }
    };
  }

  async function signOut() {
    try {
      await authRequest("logout", { method: "POST", body: {} });
    } finally {
      cachedSession = null;
      notify(null);
    }
  }

  function onAuthStateChange(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function didConfirmEmail() {
    return confirmationCompleted;
  }

  async function init() {
    const config = productionConfig();
    if (!window.DDDProductionAPI?.configure) {
      throw new ProductionAuthError("Production API client is unavailable.");
    }
    window.DDDProductionAPI.configure({ baseUrl: config.apiBaseUrl });
    if (await consumeRedirectSession()) return null;
    return fetchSession();
  }

  window.DDDProductionAuth = Object.freeze({
    ProductionAuthError,
    didConfirmEmail,
    getAccessToken,
    getSession,
    init,
    onAuthStateChange,
    sessionUser,
    signIn,
    signOut,
    signUp
  });
})();