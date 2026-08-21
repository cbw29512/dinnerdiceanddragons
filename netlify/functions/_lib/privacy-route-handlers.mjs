import { parseNotificationAction, parseOpportunityDecision } from "./privacy-api-contract.mjs";
import { privacyService } from "./privacy-service.mjs";
import { json, methodNotAllowed, readJson } from "./http.mjs";

export async function handleNotifications(user, request, parts) {
  try {
    if (parts.length === 1) {
      if (request.method !== "GET") return methodNotAllowed(["GET"]);
      return json(await privacyService.notifications(user.id));
    }
    if (parts.length === 2) {
      if (request.method !== "PATCH") return methodNotAllowed(["PATCH"]);
      const { action } = parseNotificationAction(await readJson(request));
      return json(await privacyService.markNotification(user.id, parts[1], action));
    }
    return json({ detail: "Not found." }, 404);
  } catch (error) {
    console.error("[DDD Privacy] Notification route failed", { error_type: String(error?.name || "Error") });
    throw error;
  }
}

export async function handleNotificationPreferences(user, request) {
  try {
    if (request.method === "GET") return json(await privacyService.preferences(user.id));
    if (request.method === "PUT") return json(await privacyService.savePreferences(user.id, await readJson(request)));
    return methodNotAllowed(["GET", "PUT"]);
  } catch (error) {
    console.error("[DDD Privacy] Preference route failed", { error_type: String(error?.name || "Error") });
    throw error;
  }
}

export async function handleOpportunityResponse(user, request, matchId) {
  try {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    const { decision } = parseOpportunityDecision(await readJson(request));
    return json(await privacyService.respond(user.id, matchId, decision));
  } catch (error) {
    console.error("[DDD Privacy] Opportunity response route failed", { error_type: String(error?.name || "Error") });
    throw error;
  }
}
