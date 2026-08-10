(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function apiUrl_() {
    try {
      return String(window.DDD_API_CONFIG?.baseUrl || "").trim();
    } catch (error) {
      logError("Unable to read API configuration", error);
      return "";
    }
  }

  async function post(action, payload) {
    try {
      const baseUrl = apiUrl_();
      if (!baseUrl) return { ok:false, offline:true, error:"API not configured" };
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, payload })
      });
      if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      logError(`POST ${action} failed`, error);
      return { ok:false, offline:false, error:error.message || "Request failed" };
    }
  }

  async function get(action) {
    try {
      const baseUrl = apiUrl_();
      if (!baseUrl) return { ok:false, offline:true, error:"API not configured" };
      const url = new URL(baseUrl);
      url.searchParams.set("action", action);
      const response = await fetch(url.toString(), { method:"GET" });
      if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      logError(`GET ${action} failed`, error);
      return { ok:false, offline:false, error:error.message || "Request failed" };
    }
  }

  window.DDD_API = Object.freeze({ post, get, isConfigured:() => Boolean(apiUrl_()) });
})();
