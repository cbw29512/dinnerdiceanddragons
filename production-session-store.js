(() => {
  "use strict";

  const STORAGE_KEY = "ddd-production-auth-session";

  function readRaw() {
    try {
      const current = sessionStorage.getItem(STORAGE_KEY);
      if (current) return current;

      // One-time migration from the older persistent browser storage model.
      // Remove the legacy copy immediately after moving it into tab-scoped storage.
      const legacy = localStorage.getItem(STORAGE_KEY);
      if (!legacy) return null;
      sessionStorage.setItem(STORAGE_KEY, legacy);
      localStorage.removeItem(STORAGE_KEY);
      return legacy;
    } catch {
      clear();
      return null;
    }
  }

  function write(session) {
    try {
      localStorage.removeItem(STORAGE_KEY);
      if (!session) {
        sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      throw new Error("This browser could not store the tab-scoped sign-in session.", { cause: error });
    }
  }

  function clear() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Best-effort cleanup only; callers still treat the in-memory session as signed out.
    }
  }

  window.DDDProductionSessionStore = Object.freeze({
    STORAGE_KEY,
    clear,
    readRaw,
    write
  });
})();
