import { deliveryChannels } from "./notification-contract.mjs";

const ROLE_ORDER = Object.freeze({ gm: 0, venue_manager: 1, player: 2 });

function expiry(nowIso, proposedStartIso, hours = 24) {
  const now = new Date(nowIso).getTime();
  const policy = now + hours * 60 * 60 * 1000;
  const beforeGame = new Date(proposedStartIso).getTime() - 2 * 60 * 60 * 1000;
  const target = Math.min(policy, beforeGame);
  if (!Number.isFinite(target) || target <= now) throw new Error("Opportunity is too close to start time for a new alert.");
  return new Date(target).toISOString();
}

export function createOpportunityAlertService(repository, clock = () => new Date().toISOString()) {
  if (!repository) throw new Error("Opportunity alert repository is required.");

  async function reconcile({ match, participants }) {
    try {
      const now = clock();
      const expiresAt = expiry(now, match.proposed_start);
      const active = participants
        .filter((item) => item?.user_id && ROLE_ORDER[item.role] !== undefined)
        .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.user_id.localeCompare(b.user_id));
      const wanted = new Set(active.map((item) => `${item.role}:${item.user_id}`));
      const existing = await repository.listResponses(match.id);

      for (const row of existing) {
        const key = `${row.role}:${row.user_id}`;
        if (!wanted.has(key) && ["pending", "interested"].includes(row.decision)) {
          await repository.closeResponse(row.id, "expired", now);
        }
      }

      let created = 0;
      for (const participant of active) {
        const found = existing.find((row) => row.user_id === participant.user_id && row.role === participant.role);
        if (found || await repository.matchingPaused(participant.user_id)) continue;
        await repository.createResponse({
          id: crypto.randomUUID(), table_match_id: match.id, user_id: participant.user_id,
          role: participant.role, decision: "pending", offered_at: now, expires_at: expiresAt, updated_at: now
        });
        const preferences = await repository.preferences(participant.user_id);
        const plan = deliveryChannels("match_available", preferences || {});
        for (const channel of plan.channels) {
          await repository.createNotification({
            id: crypto.randomUUID(), user_id: participant.user_id, table_match_id: match.id, event_id: null,
            type: "match_available", state: "queued", channel, payload: participant.payload || {},
            expires_at: expiresAt
          });
        }
        created += 1;
      }
      return Object.freeze({ created, expires_at: expiresAt });
    } catch (error) {
      console.error("[DDD Alerts] Unable to reconcile opportunity alerts", { error_type: String(error?.name || "Error") });
      throw error;
    }
  }

  return Object.freeze({ reconcile });
}
