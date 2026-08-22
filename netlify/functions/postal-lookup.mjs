import { currentUser } from "./_lib/auth.mjs";
import { postalPlace } from "./_lib/geo.mjs";
import { json, methodNotAllowed, route } from "./_lib/http.mjs";
import { enforceRateLimit, RATE_LIMIT_SCOPES } from "./_lib/rate-limit.mjs";

export default async (request) => route(async () => {
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  const { user } = await currentUser(request, { active: true });
  await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.PROVIDER_GEOCODING);
  const zip = new URL(request.url).searchParams.get("zip");
  const place = await postalPlace(zip);
  return json({
    postal_code: place.postal_code,
    city: place.city,
    state: place.state_code
  });
});
