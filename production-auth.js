(() => {
  "use strict";

  const SUPABASE_URL = "https://acpjfycmwbnxzlkvoouv.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_9V6jr7CdScW56IygolKgJQ_ul5v3pBb";
  const API_BASE_URL = "https://dinnerdiceanddragons.vercel.app";
  const STORAGE_KEY = "ddd-production-auth-session";
  const REFRESH_SKEW_SECONDS = 90;

  const listeners = new Set();
  let redirectConsumed = false;

  class ProductionAuthError extends Error {
    constructor(message, status = 0, detail = null) {
      super(message);
      this.name = "ProductionAuthError";
      this.status = status;
      this.detail = detail;
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
      const session = {
        ...payload,
        expires_at: expiresAt,
        user: payload.user || (claims.sub ? { id: claims.sub, email: claims.email || "" } : null)
      };
      return session;
    } catch (error) {
      throw new ProductionAuthError("Supabase returned an invalid session.", 0, error);
    }
  }

  function readStoredSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalizeSession(JSON.parse(raw));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  function storeSession(session) {
    try {
      if (!session) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      throw new ProductionAuthError("This browser could not store your sign-in session.", 0, error);
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
    const url = new URL(`${SUPABASE_URL}/auth/v1/${path}`);
    if (redirectTo) url.searchParams.set("redirect_to", redirectTo);

    const headers = {
      Accept: "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY
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
          throw new ProductionAuthError("Authentication request failed.", response.status, text);
        }
        throw new ProductionAuthError("Authentication service returned an invalid response.", response.status);
      }
    }

    if (!response.ok) {
      const message = payload.msg || payload.message || payload.error_description || payload.error || "Authentication request failed.";
      throw new ProductionAuthError(message, response.status, payload);
    }
    return payload;
  }

  function consumeRedirectSession() {
    try {
      if (redirectConsumed) return readStoredSession();
      redirectConsumed = true;
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const params = new URLSearchParams(hash);
      if (!params.get("access_token") || !params.get("refresh_token")) return readStoredSession();

      const session = normalizeSession({
        access_token: params.get("access_token"),
        refresh_token: params.get("refresh_token"),
        token_type: params.get("token_type") || "bearer",
        expires_in: Number(params.get("expires_in") || 3600)
      });
      storeSession(session);
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
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
    } catch (error) {
      storeSession(null);
      notify(null);
      if (error instanceof ProductionAuthError) return null;
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
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
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
    storeSession(null);
    notify(null);
    if (!session?.access_token) return;
    try {
      await authRequest("logout", { accessToken: session.access_token });
    } catch {
      // Local sign-out is authoritative for this browser even if remote revocation is unavailable.
    }
  }

  function onAuthStateChange(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  async function init() {
    if (!window.DDDProductionAPI?.configure) {
      throw new ProductionAuthError("Production API client is unavailable.");
    }
    window.DDDProductionAPI.configure({
      baseUrl: API_BASE_URL,
      accessTokenProvider: getAccessToken
    });
    return getSession();
  }

  try {
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY) return;
      notify(readStoredSession());
    });
  } catch {
    // Cross-tab session synchronization is optional.
  }

  window.DDDProductionAuth = Object.freeze({
    ProductionAuthError,
    init,
    getSession,
    getAccessToken,
    signIn,
    signUp,
    signOut,
    onAuthStateChange,
    sessionUser
  });
})();
