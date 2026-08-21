import { eq, insertRows, selectOne } from "../netlify/functions/_lib/database.mjs";
import { createGMSupply } from "../netlify/functions/_lib/matching-inputs.mjs";
import { saveGMOnboarding } from "../netlify/functions/_lib/onboarding.mjs";
import { weeklyAvailability } from "./netlify-database-test-helpers.mjs";

export const SECOND_GM_USER_ID = "a7400000-0000-4000-8000-000000000001";

export async function createFormationRaceGm() {
  await insertRows("users", [{
    id: SECOND_GM_USER_ID,
    auth_provider_user_id: "integration-formation-race-gm-2",
    email: "formation-race-gm-2@example.test",
    status: "active"
  }], { returning: false });

  await saveGMOnboarding({ id: SECOND_GM_USER_ID, display_name: null }, {
    display_name: "Formation Race GM Two",
    bio: null,
    postal_code: "29501",
    travel_radius_miles: 25,
    beginner_friendly: true,
    gm_style: "Balanced",
    systems: [{
      system_slug: "dnd-5e-2024",
      years_playing: 5,
      years_gming: 3,
      comfort_level: "expert",
      preferred_player_experience: "any",
      formats: ["one_shot"],
      experience_notes: null
    }],
    availability: [weeklyAvailability("saturday")]
  });

  const supply = await createGMSupply({ id: SECOND_GM_USER_ID }, {
    system_slug: "dnd-5e-2024",
    availability: [weeklyAvailability("saturday")],
    preferred_format: "one_shot",
    preferred_cadence: "weekly",
    minimum_players: 2,
    maximum_players: 2,
    table_style: "Balanced"
  });
  const profile = await selectOne("gm_profiles", { user_id: eq(SECOND_GM_USER_ID) }, { required: true });
  return { userId: SECOND_GM_USER_ID, supply, profile };
}
