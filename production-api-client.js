(() => {
  "use strict";

  let baseUrl = "";
  let accessTokenProvider = null;

  class ProductionApiError extends Error {
    constructor(message, status = 0, detail = null) {
      super(message);
      this.name = "ProductionApiError";
      this.status = status;
      this.detail = detail;
    }
  }

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function normalizeBaseUrl(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function configure(options = {}) {
    try {
      const nextBaseUrl = normalizeBaseUrl(options.baseUrl);
      if (!nextBaseUrl) throw new ProductionApiError("Production API base URL is required.");
      if (typeof options.accessTokenProvider !== "function") {
        throw new ProductionApiError("Production API accessTokenProvider must be a function.");
      }
      baseUrl = nextBaseUrl;
      accessTokenProvider = options.accessTokenProvider;
    } catch (error) {
      logError("Unable to configure production API client", error);
      throw error;
    }
  }

  function isConfigured() {
    return Boolean(baseUrl && accessTokenProvider);
  }

  async function parseResponse(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (error) {
      logError("Production API returned invalid JSON", error);
      throw new ProductionApiError("Production API returned an invalid response.", response.status);
    }
  }

  async function request(method, path, payload = undefined) {
    try {
      if (!isConfigured()) throw new ProductionApiError("Production API client is not configured.");
      const token = String(await accessTokenProvider() || "").trim();
      if (!token) throw new ProductionApiError("An authenticated session is required.", 401);

      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(payload === undefined ? {} : { "Content-Type": "application/json" })
        },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) })
      });
      const body = await parseResponse(response);
      if (!response.ok) {
        const detail = body?.detail || body?.error || null;
        throw new ProductionApiError(
          typeof detail === "string" ? detail : `Production API request failed (${response.status}).`,
          response.status,
          detail
        );
      }
      return body;
    } catch (error) {
      logError(`${method} ${path} failed`, error);
      throw error;
    }
  }

  function eventPath(eventId, suffix = "") {
    return `/api/v1/events/${encodeURIComponent(String(eventId || ""))}${suffix}`;
  }

  window.DDDProductionAPI = Object.freeze({
    ProductionApiError,
    configure,
    isConfigured,
    getMe: () => request("GET", "/api/v1/me"),
    getPlayerOnboarding: () => request("GET", "/api/v1/onboarding/player"),
    putPlayerOnboarding: (payload) => request("PUT", "/api/v1/onboarding/player", payload),
    getGMOnboarding: () => request("GET", "/api/v1/onboarding/gm"),
    putGMOnboarding: (payload) => request("PUT", "/api/v1/onboarding/gm", payload),
    postVenueOnboarding: (payload) => request("POST", "/api/v1/onboarding/venue", payload),
    getGameHubs: () => request("GET", "/api/v1/game-hubs"),
    getEvent: (eventId) => request("GET", eventPath(eventId)),
    getGameHub: (eventId) => request("GET", eventPath(eventId, "/hub")),
    getHubMessages: (eventId, { limit = 50, cursor = "" } = {}) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (cursor) params.set("cursor", cursor);
      return request("GET", `${eventPath(eventId, "/messages")}?${params.toString()}`);
    },
    postHubMessage: (eventId, payload) => request("POST", eventPath(eventId, "/messages"), payload),
    postRegistration: (eventId) => request("POST", eventPath(eventId, "/registrations"), { expectations_acknowledged: true }),
    cancelMyRegistration: (eventId) => request("PATCH", eventPath(eventId, "/registrations/me"), { action: "cancel" }),
    decideRegistration: (eventId, registrationId, action) => request(
      "PATCH",
      eventPath(eventId, `/registrations/${encodeURIComponent(String(registrationId || ""))}`),
      { action }
    ),
    decideVenueBooking: (bookingId, action, message = null) => request(
      "PATCH",
      `/api/v1/venue-bookings/${encodeURIComponent(String(bookingId || ""))}`,
      { action, ...(message ? { message } : {}) }
    )
  });
})();
