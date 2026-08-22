import { eq, selectOne, updateRows } from "./supabase-rest.mjs";

export async function matchingSignalStatus(userId) {
  try {
    const prefs = await selectOne("notification_preferences", { user_id: eq(userId) });
    return prefs?.matching_paused ? "paused" : "active";
  } catch (error) {
    console.error("[Dinner Dice & Dragons] Unable to resolve matching participation state", error);
    throw error;
  }
}

async function updateProfileSignals(table, ownerColumn, profileId, paused) {
  if (!profileId) return 0;
  const from = paused ? "active" : "paused";
  const to = paused ? "paused" : "active";
  const rows = await updateRows(table, {
    [ownerColumn]: eq(profileId),
    status: eq(from)
  }, {
    status: to,
    updated_at: new Date().toISOString()
  });
  return Array.isArray(rows) ? rows.length : 0;
}

export async function syncMatchingPause(userId, paused) {
  try {
    const [player, gm] = await Promise.all([
      selectOne("player_profiles", { user_id: eq(userId) }),
      selectOne("gm_profiles", { user_id: eq(userId) })
    ]);
    const [playerSignals, gmSignals] = await Promise.all([
      updateProfileSignals("player_demand_signals", "player_profile_id", player?.id, paused),
      updateProfileSignals("gm_supply_signals", "gm_profile_id", gm?.id, paused)
    ]);
    return { player_signals: playerSignals, gm_signals: gmSignals };
  } catch (error) {
    console.error("[Dinner Dice & Dragons] Unable to synchronize matching pause", error);
    throw error;
  }
}