import { listGameReminders, replaceGameReminders } from "./game-reminders.mjs";
import { json, methodNotAllowed, readJson } from "./http.mjs";

export async function handleGameReminders(user, request, matchId) {
  try {
    if (request.method === "GET") {
      return json(await listGameReminders(user, matchId));
    }
    if (request.method === "PUT") {
      const payload = await readJson(request);
      return json(await replaceGameReminders(user, matchId, payload?.minutes_before));
    }
    return methodNotAllowed(["GET", "PUT"]);
  } catch (error) {
    console.error("[DDD Reminders] Unable to handle reminder request", {
      error_type: String(error?.name || "Error")
    });
    throw error;
  }
}
