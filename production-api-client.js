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
      if (options.accessTokenProvider != null && typeof options.accessTokenProvider !== "function") {
        throw new ProductionApiError("Production API accessTokenProvider must be a function when supplied.");
      }
      baseUrl = nextBaseUrl;
      accessTokenProvider = options.accessTokenProvider || null;
    } catch (error) {
      logError("Unable to configure production API client", error);
      throw error;
    }
  }

  function isConfigured() { return Boolean(baseUrl); }

  async function parseResponse(response) {
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); }
    catch (error) {
      logError("Production API returned invalid JSON", error);
      throw new ProductionApiError("Production API returned an invalid response.", response.status);
    }
  }

  async function request(method, path, payload = undefined, options = {}) {
    try {
      if (!isConfigured()) throw new ProductionApiError("Production API client is not configured.");
      const token = accessTokenProvider ? String(await accessTokenProvider() || "").trim() : "";
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      if (!(options.silentStatuses || []).includes(Number(error?.status))) logError(`${method} ${path} failed`, error);
      throw error;
    }
  }

  async function optionalOnboarding(path) {
    try { return await request("GET", path, undefined, { silentStatuses: [404] }); }
    catch (error) { if (error?.status === 404) return null; throw error; }
  }

  function eventPath(eventId, suffix = "") {
    return `/api/v1/events/${encodeURIComponent(String(eventId || ""))}${suffix}`;
  }
  function opportunityPath(tableMatchId, suffix = "") {
    return `/api/v1/matching/opportunities/${encodeURIComponent(String(tableMatchId || ""))}${suffix}`;
  }
  function venueWindowPath(venueId) {
    return `/api/v1/matching/venues/${encodeURIComponent(String(venueId || ""))}/table-windows`;
  }

  window.DDDProductionAPI = Object.freeze({
    ProductionApiError,
    configure,
    isConfigured,
    getMe: () => request("GET", "/api/v1/me"),
    getNotifications: () => request("GET", "/api/v1/notifications"),
    markNotification: (notificationId, action) => request("PATCH", `/api/v1/notifications/${encodeURIComponent(String(notificationId || ""))}`, { action }),
    getNotificationPreferences: () => request("GET", "/api/v1/notification-preferences"),
    putNotificationPreferences: (payload) => request("PUT", "/api/v1/notification-preferences", payload),
    getPlayerOnboarding: () => request("GET", "/api/v1/onboarding/player"),
    getPlayerOnboardingOptional: () => optionalOnboarding("/api/v1/onboarding/player"),
    putPlayerOnboarding: (payload) => request("PUT", "/api/v1/onboarding/player", payload),
    getGMOnboarding: () => request("GET", "/api/v1/onboarding/gm"),
    getGMOnboardingOptional: () => optionalOnboarding("/api/v1/onboarding/gm"),
    putGMOnboarding: (payload) => request("PUT", "/api/v1/onboarding/gm", payload),
    postVenueOnboarding: (payload) => request("POST", "/api/v1/onboarding/venue", payload),
    getPlayerDemands: () => request("GET", "/api/v1/matching/player-demands"),
    postPlayerDemand: (payload) => request("POST", "/api/v1/matching/player-demands", payload),
    getGMSupplies: () => request("GET", "/api/v1/matching/gm-supplies"),
    postGMSupply: (payload) => request("POST", "/api/v1/matching/gm-supplies", payload),
    getVenueTableWindows: (venueId) => request("GET", venueWindowPath(venueId)),
    postVenueTableWindow: (venueId, payload) => request("POST", venueWindowPath(venueId), payload),
    findMyTable: (horizonDays = 60) => request("POST", "/api/v1/matching/find-my-table", { horizon_days: horizonDays }),
    getMatchingOpportunities: () => request("GET", "/api/v1/matching/opportunities"),
    getMatchingOpportunity: (tableMatchId) => request("GET", opportunityPath(tableMatchId)),
    respondToOpportunity: (tableMatchId, role, decision) => request("POST", opportunityPath(tableMatchId, "/respond"), { role, decision }),
    getGameReminders: (tableMatchId) => request("GET", opportunityPath(tableMatchId, "/reminders")),
    putGameReminders: (tableMatchId, minutesBefore) => request("PUT", opportunityPath(tableMatchId, "/reminders"), { minutes_before: minutesBefore }),
    formTableMatch: (tableMatchId, payload) => request("POST", opportunityPath(tableMatchId, "/form"), payload),
    getGameHubs: () => request("GET", "/api/v1/game-hubs"),
    getEvent: (eventId) => request("GET", eventPath(eventId)),
    getGameHub: (eventId) => request("GET", eventPath(eventId, "/hub")),
    getAnnouncements: (eventId) => request("GET", eventPath(eventId, "/announcements")),
    postAnnouncement: (eventId, body) => request("POST", eventPath(eventId, "/announcements"), { body }),
    postRegistration: (eventId) => request("POST", eventPath(eventId, "/registrations"), { expectations_acknowledged: true }),
    cancelMyRegistration: (eventId) => request("PATCH", eventPath(eventId, "/registrations/me"), { action: "cancel" }),
    decideRegistration: (eventId, registrationId, action) => request("PATCH", eventPath(eventId, `/registrations/${encodeURIComponent(String(registrationId || ""))}`), { action }),
    decideVenueBooking: (bookingId, action) => request("PATCH", `/api/v1/venue-bookings/${encodeURIComponent(String(bookingId || ""))}`, { action })
  });
})();
