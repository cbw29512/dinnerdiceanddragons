import { confirmEmail, getUser, login, logout, refreshSession, signup, verifyRequestOrigin } from "@netlify/identity";
import { listAnnouncements, postAnnouncement } from "./_lib/announcements.mjs";
import { currentUser, publicCurrentUser, userRoles } from "./_lib/auth.mjs";
import { databaseHealth } from "./_lib/database.mjs";
import { getEvent, getGameHub, listGameHubs } from "./_lib/event-location-view.mjs";
import { json, methodNotAllowed, noContent, notFound, pathParts, readJson, route } from "./_lib/http.mjs";
import { listManagedVenues, replaceVenueCalendar } from "./_lib/managed-venues.mjs";
import {
  createGMSupply,
  createPlayerDemand,
  createVenueTableWindow,
  listGMSupplies,
  listPlayerDemands,
  listVenueTableWindows
} from "./_lib/matching-inputs.mjs";
import { runMatching } from "./_lib/matching-engine.mjs";
import { findMyTable, getOpportunity, listOpportunities } from "./_lib/opportunities.mjs";
import { formAcceptedTableMatch } from "./_lib/matched-event-formation.mjs";
import {
  cancelMyRegistration,
  decideRegistration,
  decideVenueBooking,
  requestRegistration
} from "./_lib/lifecycle.mjs";
import {
  createVenueOnboarding,
  loadGMOnboarding,
  loadPlayerOnboarding,
  saveGMOnboarding,
  savePlayerOnboarding
} from "./_lib/onboarding.mjs";
import {
  handleNotificationPreferences,
  handleNotifications,
  handleOpportunityResponse
} from "./_lib/privacy-route-handlers.mjs";
import { handleGameReminders } from "./_lib/reminder-route-handlers.mjs";
import { enforceRateLimit, RATE_LIMIT_SCOPES } from "./_lib/rate-limit.mjs";
import { SupabaseRestError } from "./_lib/supabase-rest.mjs";
import { verifyVenueClaim } from "./_lib/venue-verification.mjs";

function activeUser(request) { return currentUser(request, { active: true }); }
function authFailure(error, fallback) {
  const status = Number(error?.status || error?.statusCode || 0);
  if (status === 403) return new SupabaseRestError("Authentication request was rejected.", 403);
  if (status >= 400 && status < 500) return new SupabaseRestError(fallback, status);
  console.warn("[Dinner Dice & Dragons] Netlify Identity request failed", error);
  return new SupabaseRestError("Authentication is temporarily unavailable.", 503);
}
function credentials(payload) {
  const email = String(payload?.email || "").trim().toLowerCase();
  const password = String(payload?.password || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) throw new SupabaseRestError("Enter a valid email address.", 422);
  if (password.length < 8 || password.length > 128) throw new SupabaseRestError("Password must be between 8 and 128 characters.", 422);
  return { email, password };
}

async function auth(request, parts) {
  const action = parts[1];
  if (action === "session" && parts.length === 2) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    try {
      await refreshSession();
      const user = await getUser();
      return json(user ? { authenticated: true, id: user.id, email: user.email } : { authenticated: false });
    } catch (error) {
      throw authFailure(error, "Authentication session could not be refreshed.");
    }
  }
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  try {
    verifyRequestOrigin(request);
    if (action === "signup" && parts.length === 2) {
      const { email, password } = credentials(await readJson(request));
      const user = await signup(email, password, {});
      return json({ status: "confirmation_required", email: user?.email || email }, 201);
    }
    if (action === "login" && parts.length === 2) {
      const { email, password } = credentials(await readJson(request));
      const user = await login(email, password);
      return json({ authenticated: true, id: user.id, email: user.email });
    }
    if (action === "logout" && parts.length === 2) { await logout(); return noContent(); }
    if (action === "confirm" && parts.length === 2) {
      const payload = await readJson(request);
      const token = String(payload?.token || "").trim();
      if (!token || token.length > 4096) throw new SupabaseRestError("Confirmation token is invalid.", 422);
      const user = await confirmEmail(token);
      return json({ confirmed: true, id: user.id, email: user.email });
    }
  } catch (error) {
    if (error instanceof SupabaseRestError) throw error;
    throw authFailure(error, action === "login" ? "Email or password is incorrect." : "Authentication request could not be completed.");
  }
  return notFound();
}

async function identity(request) {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  const { user } = await currentUser(request);
  return json({ ...publicCurrentUser(user), roles: await userRoles(user.id) });
}

async function onboarding(request, parts) {
  const { user } = await activeUser(request);
  const kind = parts[1];
  if (kind === "player") {
    if (request.method === "GET") return json(await loadPlayerOnboarding(user));
    if (request.method === "PUT") {
      await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.ONBOARDING_MUTATION);
      return json(await savePlayerOnboarding(user, await readJson(request)), 200);
    }
    return methodNotAllowed(["GET", "PUT"]);
  }
  if (kind === "gm") {
    if (request.method === "GET") return json(await loadGMOnboarding(user));
    if (request.method === "PUT") {
      await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.ONBOARDING_MUTATION);
      return json(await saveGMOnboarding(user, await readJson(request)), 200);
    }
    return methodNotAllowed(["GET", "PUT"]);
  }
  if (kind === "venue") {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.ONBOARDING_MUTATION);
    return json(await createVenueOnboarding(user, await readJson(request)), 201);
  }
  if (kind === "venues" && parts.length === 2) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return json(await listManagedVenues(user));
  }
  return notFound();
}

async function matching(request, parts) {
  const { user } = await activeUser(request);
  if (parts[1] === "player-demands" && parts.length === 2) {
    if (request.method === "GET") return json(await listPlayerDemands(user));
    if (request.method === "POST") { await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.MATCHING_INPUT); return json(await createPlayerDemand(user, await readJson(request)), 201); }
    return methodNotAllowed(["GET", "POST"]);
  }
  if (parts[1] === "gm-supplies" && parts.length === 2) {
    if (request.method === "GET") return json(await listGMSupplies(user));
    if (request.method === "POST") { await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.MATCHING_INPUT); return json(await createGMSupply(user, await readJson(request)), 201); }
    return methodNotAllowed(["GET", "POST"]);
  }
  if (parts[1] === "venues" && parts[2] && parts[3] === "table-windows" && parts.length === 4) {
    if (request.method === "GET") return json(await listVenueTableWindows(user, parts[2]));
    if (request.method === "POST") { await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.MATCHING_INPUT); return json(await createVenueTableWindow(user, parts[2], await readJson(request)), 201); }
    if (request.method === "PUT") { await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.MATCHING_INPUT); return json(await replaceVenueCalendar(user, parts[2], await readJson(request))); }
    return methodNotAllowed(["GET", "POST", "PUT"]);
  }
  if (parts[1] === "find-my-table" && parts.length === 2) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.MATCHING_REFRESH);
    const payload = await readJson(request);
    const run = await runMatching({ horizonDays: payload.horizon_days ?? 60 });
    return json(await findMyTable(user, run));
  }
  if (parts[1] === "opportunities" && parts.length === 2) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return json(await listOpportunities(user));
  }
  if (parts[1] === "opportunities" && parts[2] && parts[3] === "respond" && parts.length === 4) {
    await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.TABLE_FORMATION);
    return handleOpportunityResponse(user, request, parts[2]);
  }
  if (parts[1] === "opportunities" && parts[2] && parts[3] === "reminders" && parts.length === 4) return handleGameReminders(user, request, parts[2]);
  if (parts[1] === "opportunities" && parts[2] && parts.length === 3) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return json(await getOpportunity(user, parts[2]));
  }
  if (parts[1] === "opportunities" && parts[2] && parts[3] === "form" && parts.length === 4) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.TABLE_FORMATION);
    return json(await formAcceptedTableMatch(user, parts[2], await readJson(request)));
  }
  return notFound();
}

async function events(request, parts) {
  const { user } = await activeUser(request);
  const eventId = parts[1];
  if (!eventId) return notFound();
  if (parts.length === 2) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return json(await getEvent(user, eventId));
  }
  if (parts[2] === "hub" && parts.length === 3) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return json(await getGameHub(user, eventId));
  }
  if (parts[2] === "announcements" && parts.length === 3) {
    if (request.method === "GET") return json(await listAnnouncements(user, eventId));
    if (request.method === "POST") { await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.HUB_MESSAGE); return json(await postAnnouncement(user, eventId, await readJson(request)), 201); }
    return methodNotAllowed(["GET", "POST"]);
  }
  if (parts[2] === "registrations" && parts.length === 3) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.EVENT_REGISTRATION);
    const payload = await readJson(request);
    return json(await requestRegistration(user, eventId, payload.expectations_acknowledged), 201);
  }
  if (parts[2] === "registrations" && parts[3] === "me" && parts.length === 4) {
    if (request.method !== "PATCH") return methodNotAllowed(["PATCH"]);
    await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.EVENT_REGISTRATION);
    const payload = await readJson(request);
    if (payload.action !== "cancel") throw new SupabaseRestError("Unsupported Player registration action.", 422);
    return json(await cancelMyRegistration(user, eventId));
  }
  if (parts[2] === "registrations" && parts[3] && parts.length === 4) {
    if (request.method !== "PATCH") return methodNotAllowed(["PATCH"]);
    await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.EVENT_REGISTRATION);
    const payload = await readJson(request);
    return json(await decideRegistration(user, eventId, parts[3], payload.action));
  }
  return notFound();
}

async function booking(request, parts) {
  if (!parts[1]) return notFound();
  if (request.method !== "PATCH") return methodNotAllowed(["PATCH"]);
  const { user } = await activeUser(request);
  await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.VENUE_BOOKING);
  const payload = await readJson(request);
  if (!["approve", "decline", "cancel"].includes(payload.action)) throw new SupabaseRestError("Unsupported Venue booking action.", 422);
  return json(await decideVenueBooking(user, parts[1], payload.action, null));
}

async function admin(request, parts) {
  if (parts.length !== 6 || parts[1] !== "venues" || parts[3] !== "manager-claims" || parts[5] !== "verify") return notFound();
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  const { user } = await activeUser(request);
  await verifyVenueClaim(user, parts[2], parts[4]);
  return noContent();
}

export default async (request) => route(async () => {
  const parts = pathParts(request);
  if (parts[0] === "health" && parts.length === 1) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    const database = await databaseHealth();
    return json({ status: database ? "ok" : "degraded", runtime: "netlify-functions", database: "netlify-database", identity: "netlify-identity", version: "v1" }, database ? 200 : 503);
  }
  if (parts[0] === "auth") return auth(request, parts);
  if (parts[0] === "me" && parts.length === 1) return identity(request);
  if (parts[0] === "onboarding") return onboarding(request, parts);
  if (parts[0] === "matching") return matching(request, parts);
  if (parts[0] === "notifications") { const { user } = await activeUser(request); return handleNotifications(user, request, parts); }
  if (parts[0] === "notification-preferences" && parts.length === 1) { const { user } = await activeUser(request); return handleNotificationPreferences(user, request); }
  if (parts[0] === "game-hubs" && parts.length === 1) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    const { user } = await activeUser(request);
    return json(await listGameHubs(user));
  }
  if (parts[0] === "events") return events(request, parts);
  if (parts[0] === "venue-bookings") return booking(request, parts);
  if (parts[0] === "admin") return admin(request, parts);
  return notFound();
});

export const config = { path: "/api/*" };
