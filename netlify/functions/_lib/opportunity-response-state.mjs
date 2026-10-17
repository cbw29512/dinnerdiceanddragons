const ROLES = new Set(["player", "gm", "venue_manager"]);
const DECISIONS = new Set(["pending", "interested", "accepted", "declined", "waitlisted", "expired"]);
const USER_ACTIONS = new Set(["interested", "accepted", "declined"]);

export class OpportunityResponseStateError extends Error {
  constructor(message) {
    super(message);
    this.name = "OpportunityResponseStateError";
  }
}

export function normalizeResponse(raw) {
  try {
    const role = String(raw?.role || "");
    const decision = String(raw?.decision || "pending");
    if (!ROLES.has(role)) throw new OpportunityResponseStateError("Opportunity role is invalid.");
    if (!DECISIONS.has(decision)) throw new OpportunityResponseStateError("Opportunity decision is invalid.");
    const userId = String(raw?.user_id || "").trim();
    if (!userId) throw new OpportunityResponseStateError("Opportunity user is required.");
    return Object.freeze({ user_id: userId, role, decision, offered_at: raw?.offered_at || null, expires_at: raw?.expires_at || null });
  } catch (error) {
    if (error instanceof OpportunityResponseStateError) throw error;
    throw new OpportunityResponseStateError("Unable to normalize opportunity response.");
  }
}

export function applyUserDecision(response, decision, nowIso = new Date().toISOString()) {
  try {
    const current = normalizeResponse(response);
    if (!USER_ACTIONS.has(decision)) throw new OpportunityResponseStateError("Unsupported user opportunity action.");
    if (["declined", "expired"].includes(current.decision)) throw new OpportunityResponseStateError("Opportunity response is already closed.");
    if (current.expires_at && new Date(nowIso) >= new Date(current.expires_at)) throw new OpportunityResponseStateError("Opportunity response has expired.");
    return Object.freeze({ ...current, decision, responded_at: nowIso, updated_at: nowIso });
  } catch (error) {
    if (error instanceof OpportunityResponseStateError) throw error;
    throw new OpportunityResponseStateError("Unable to apply opportunity decision.");
  }
}

export function formationProgress(responses, minimumPlayers) {
  try {
    const minimum = Number(minimumPlayers);
    if (!Number.isInteger(minimum) || minimum < 1) throw new OpportunityResponseStateError("Minimum Players is invalid.");
    const accepted = responses.map(normalizeResponse).filter((row) => row.decision === "accepted");
    const gmAccepted = accepted.some((row) => row.role === "gm");
    const venueAccepted = accepted.some((row) => row.role === "venue_manager");
    const acceptedPlayers = accepted.filter((row) => row.role === "player").length;
    return Object.freeze({ gmAccepted, venueAccepted, acceptedPlayers, formed: gmAccepted && venueAccepted && acceptedPlayers >= minimum });
  } catch (error) {
    if (error instanceof OpportunityResponseStateError) throw error;
    throw new OpportunityResponseStateError("Unable to calculate formation progress.");
  }
}
