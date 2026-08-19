import { currentUser, publicCurrentUser, userRoles } from "./_lib/auth.mjs";
import { json, methodNotAllowed, notFound, pathParts, readJson, route } from "./_lib/http.mjs";
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
import {
  cancelMyRegistration,
  decideRegistration,
  decideVenueBooking,
  formTableMatch,
  getEvent,
  getGameHub,
  getHubMessages,
  listGameHubs,
  postHubMessage,
  requestRegistration
} from "./_lib/lifecycle.mjs";
import {
  createVenueOnboarding,
  loadGMOnboarding,
  loadPlayerOnboarding,
  saveGMOnboarding,
  savePlayerOnboarding
} from "./_lib/onboarding.mjs";
import { SupabaseRestError } from "./_lib/supabase-rest.mjs";

function activeUser(request) {
  return currentUser(request, { active: true });
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
    if (request.method === "PUT") return json(await savePlayerOnboarding(user, await readJson(request)), 200);
    return methodNotAllowed(["GET", "PUT"]);
  }
  if (kind === "gm") {
    if (request.method === "GET") return json(await loadGMOnboarding(user));
    if (request.method === "PUT") return json(await saveGMOnboarding(user, await readJson(request)), 200);
    return methodNotAllowed(["GET", "PUT"]);
  }
  if (kind === "venue") {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    return json(await createVenueOnboarding(user, await readJson(request)), 201);
  }
  return notFound();
}

async function matching(request, parts) {
  const { user } = await activeUser(request);
  if (parts[1] === "player-demands" && parts.length === 2) {
    if (request.method === "GET") return json(await listPlayerDemands(user));
    if (request.method === "POST") return json(await createPlayerDemand(user, await readJson(request)), 201);
    return methodNotAllowed(["GET", "POST"]);
  }
  if (parts[1] === "gm-supplies" && parts.length === 2) {
    if (request.method === "GET") return json(await listGMSupplies(user));
    if (request.method === "POST") return json(await createGMSupply(user, await readJson(request)), 201);
    return methodNotAllowed(["GET", "POST"]);
  }
  if (parts[1] === "venues" && parts[2] && parts[3] === "table-windows" && parts.length === 4) {
    if (request.method === "GET") return json(await listVenueTableWindows(user, parts[2]));
    if (request.method === "POST") return json(await createVenueTableWindow(user, parts[2], await readJson(request)), 201);
    return methodNotAllowed(["GET", "POST"]);
  }
  if (parts[1] === "find-my-table" && parts.length === 2) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    const payload = await readJson(request);
    const run = await runMatching({ horizonDays: payload.horizon_days ?? 60 });
    return json(await findMyTable(user, run));
  }
  if (parts[1] === "opportunities" && parts.length === 2) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return json(await listOpportunities(user));
  }
  if (parts[1] === "opportunities" && parts[2] && parts.length === 3) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return json(await getOpportunity(user, parts[2]));
  }
  if (parts[1] === "opportunities" && parts[2] && parts[3] === "form" && parts.length === 4) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    return json(await formTableMatch(user, parts[2], await readJson(request)));
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
  if (parts[2] === "messages" && parts.length === 3) {
    if (request.method === "GET") {
      const url = new URL(request.url);
      return json(await getHubMessages(user, eventId, {
        limit: url.searchParams.get("limit") || 50,
        cursor: url.searchParams.get("cursor") || ""
      }));
    }
    if (request.method === "POST") return json(await postHubMessage(user, eventId, await readJson(request)), 201);
    return methodNotAllowed(["GET", "POST"]);
  }
  if (parts[2] === "registrations" && parts.length === 3) {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    const payload = await readJson(request);
    return json(await requestRegistration(user, eventId, payload.expectations_acknowledged), 201);
  }
  if (parts[2] === "registrations" && parts[3] === "me" && parts.length === 4) {
    if (request.method !== "PATCH") return methodNotAllowed(["PATCH"]);
    const payload = await readJson(request);
    if (payload.action !== "cancel") throw new SupabaseRestError("Unsupported Player registration action.", 422);
    return json(await cancelMyRegistration(user, eventId));
  }
  if (parts[2] === "registrations" && parts[3] && parts.length === 4) {
    if (request.method !== "PATCH") return methodNotAllowed(["PATCH"]);
    const payload = await readJson(request);
    return json(await decideRegistration(user, eventId, parts[3], payload.action));
  }
  return notFound();
}

async function booking(request, parts) {
  if (!parts[1]) return notFound();
  if (request.method !== "PATCH") return methodNotAllowed(["PATCH"]);
  const { user } = await activeUser(request);
  const payload = await readJson(request);
  return json(await decideVenueBooking(user, parts[1], payload.action, payload.message));
}

export default async (request) => route(async () => {
  const parts = pathParts(request);
  if (parts[0] === "health" && parts.length === 1) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return json({ status: "ok", runtime: "netlify-functions", version: "v1" });
  }
  if (parts[0] === "me" && parts.length === 1) return identity(request);
  if (parts[0] === "onboarding") return onboarding(request, parts);
  if (parts[0] === "matching") return matching(request, parts);
  if (parts[0] === "game-hubs" && parts.length === 1) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    const { user } = await activeUser(request);
    return json(await listGameHubs(user));
  }
  if (parts[0] === "events") return events(request, parts);
  if (parts[0] === "venue-bookings") return booking(request, parts);
  return notFound();
});

export const config = {
  path: "/api/*"
};
