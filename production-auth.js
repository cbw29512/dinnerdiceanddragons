(() => {
  "use strict";

  const REFRESH_SKEW_SECONDS = 90;
  const listeners = new Set();
  let redirectConsumed = false;
  let validatedConfig = null;

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
    if (!config) {
      throw new ProductionAuthError("Production browser configuration is unavailable.");
    }

    try {
      const api = new URL(String(config.apiBaseUrl || ""));
      const supabase = new URL(String(config.supabaseUrl || ""));
      const publishableKey = String(config.supabasePublishableKey || "").trim();
      if (api.protocol !== "https:" || supabase.protocol !== "https:") {
        throw new Error("Production endpoints must use HTTPS.");
      }
      if (!publishableKey.startsWith("sb_publishable_")) {
        throw new Error("Supabase publishable key is invalid.");
      }
      validatedConfig = Object.freeze({
        apiBaseUrl: api.origin,
        supabaseUrl: supabase.origin,
        supabasePublishableKey: publishableKey
      });
      return validatedConfig;
    } catch (error) {
      throw new ProductionAuthError("Production browser configuration is invalid.", 0, error);
    }
  }

  function sessionStore() {
    const store = window.DDDProductionSessionStore;
    if (!store?.readRaw || !store?.write || !store?.clear) {
      throw new ProductionAuthError("Secure tab-scoped session storage is unavailable.");
    }
    return store;
  }

  function clearStoredSessionSafely() {
    try {
      window.DDDProductionSessionStore?.clear?.();
    } catch {
      // Storage cleanup is best effort; callers still transition to signed-out state.
    }
  }

  function decodeJwtClaims(token) {
    try {
      const part = String(token || "").split(".")[1];
      if (!part) return {};
      const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      return JSON.parse(atob(padded));
    } catch {
      return {};
    }
  }

  function sessionUser(session) {
    try {
      if (session?.user) return session.user;
      const claims = decodeJwtClaims(session?.access_token);
      if (!claims.sub) return null;
      return { id: claims.sub, email: claims.email || "" };
    } catch {
      return null;
    }
  }

  function normalizeSession(payload) {
    try {
      if (!payload?.access_token || !payload?.refresh_token) return null;
      const claims = decodeJwtClaims(payload.access_token);
      const expiresAt = Number(payload.expires_at || claims.exp || 0) ||
        Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600);
      return {
        ...payload,
        expires_at: expiresAt,
        user: payload.user || (claims.sub ? { id: claims.sub, email: claims.email || "" } : null)
      };
    } catch (error) {
      throw new ProductionAuthError("Supabase returned an invalid session.", 0, error);
    }
  }

  function readStoredSession() {
    try {
      const raw = sessionStore().readRaw();
      if (!raw) return null;
      return normalizeSession(JSON.parse(raw));
    } catch {
      clearStoredSessionSafely();
      return null;
    }
  }

  function storeSession(session) {
    try {
      sessionStore().write(session);
    } catch (error) {
      throw new ProductionAuthError("This browser could not store your tab-scoped sign-in session.", 0, error);
    }
  }

  function notify(session) {
    listeners.forEach((listener) => {
      try {
        listener(session);
      } catch {
        // One UI listener must not break authentication for the rest of the page.
      }
    });
  }

  async function authRequest(path, { method = "POST", body = null, accessToken = "", redirectTo = "" } = {}) {
    const config = productionConfig();
    const url = new URL(`${config.supabaseUrl}/auth/v1/${path}`);
    if (redirectTo) url.searchParams.set("redirect_to", redirectTo);

    const headers = {
      Accept: "application/json",
      apikey: config.supabasePublishableKey
    };
    if (body !== null) headers["Content-Type"] = "application/json";
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        ...(body === null ? {} : { body: JSON.stringify(body) })
      });
    } catch (error) {
      throw new ProductionAuthError("Authentication service is temporarily unreachable.", 0, error);
    }

    const text = await response.text();
    let payload = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        if (!response.ok) {
          throw new ProductionAuthError("Authentication request failed.", response.status);
        }
        throw new ProductionAuthError("Authentication service returned an invalid response.", response.status);
      }
    }

    if (!response.ok) {
      const message = payload.msg || payload.message || payload.error_description || payload.error || "Authentication request failed.";
      throw new ProductionAuthError(message, response.status);
    }
    return payload;
  }

  function consumeRedirectSession() {
    try {
      if (redirectConsumed) return readStoredSession();
      redirectConsumed = true;
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      if (!accessToken || !refreshToken) return readStoredSession();

      // Remove bearer credentials from the visible URL before parsing/storing them.
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      const session = normalizeSession({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: params.get("token_type") || "bearer",
        expires_in: Number(params.get("expires_in") || 3600)
      });
      storeSession(session);
      notify(session);
      return session;
    } catch {
      return readStoredSession();
    }
  }

  async function refreshSession(session) {
    try {
      if (!session?.refresh_token) return null;
      const payload = await authRequest("token?grant_type=refresh_token", {
        body: { refresh_token: session.refresh_token }
      });
      const refreshed = normalizeSession(payload);
      storeSession(refreshed);
      notify(refreshed);
      return refreshed;
    } catch {
      clearStoredSessionSafely();
      notify(null);
      return null;
    }
  }

  async function getSession() {
    let session = consumeRedirectSession();
    if (!session) return null;

    const now = Math.floor(Date.now() / 1000);
    if (Number(session.expires_at || 0) <= now + REFRESH_SKEW_SECONDS) {
      session = await refreshSession(session);
    }
    return session;
  }

  async function getAccessToken() {
    const session = await getSession();
    return session?.access_token || "";
  }

  async function signIn(email, password) {
    const payload = await authRequest("token?grant_type=password", {
      body: { email: String(email || "").trim(), password: String(password || "") }
    });
    const session = normalizeSession(payload);
    if (!session) throw new ProductionAuthError("Supabase did not return a sign-in session.");
    storeSession(session);
    notify(session);
    return session;
  }

  async function signUp(email, password) {
    const redirectTo = new URL("join.html", window.location.href).toString();
    const payload = await authRequest("signup", {
      redirectTo,
      body: {
        email: String(email || "").trim(),
        password: String(password || ""),
        data: {}
      }
    });
    const session = normalizeSession(payload);
    if (session) {
      storeSession(session);
      notify(session);
    }
    return { session, user: payload.user || (session ? sessionUser(session) : payload) };
  }

  async function signOut() {
    const session = readStoredSession();
    clearStoredSessionSafely();
    notify(null);
    if (!session?.access_token) return;
    try {
      await authRequest("logout", { accessToken: session.access_token });
    } catch {
      // Local sign-out is authoritative for this tab even if remote revocation is unavailable.
    }
  }

  function onAuthStateChange(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  async function init() {
    const config = productionConfig();
    sessionStore();
    if (!window.DDDProductionAPI?.configure) {
      throw new ProductionAuthError("Production API client is unavailable.");
    }
    window.DDDProductionAPI.configure({
      baseUrl: config.apiBaseUrl,
      accessTokenProvider: getAccessToken
    });
    return getSession();
  }

  window.DDDProductionAuth = Object.freeze({
    ProductionAuthError,
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
