import { eq, selectMany, updateRows } from "./supabase-rest.mjs";

const REPLACEABLE = new Set(["active", "paused"]);

export async function expireSupersededSignals({ table, ownerColumn, ownerId, gameSystemId, keepId }) {
  try {
    const rows = await selectMany(table, {
      [ownerColumn]: eq(ownerId),
      game_system_id: eq(gameSystemId),
      limit: 50
    });
    const now = new Date().toISOString();
    let expired = 0;
    for (const row of rows) {
      if (row.id === keepId || !REPLACEABLE.has(row.status)) continue;
      await updateRows(table, { id: eq(row.id) }, {
        status: "expired",
        updated_at: now
      }, { returning: false });
      expired += 1;
    }
    return expired;
  } catch (error) {
    console.error(`[Dinner Dice & Dragons] Unable to expire superseded signals in ${table}`, error);
    throw error;
  }
}