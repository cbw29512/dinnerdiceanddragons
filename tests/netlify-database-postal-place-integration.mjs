import assert from "node:assert/strict";

import { postalPlaceFromPayload } from "../netlify/functions/_lib/geo.mjs";

const place = postalPlaceFromPayload("29501", {
  places: [{
    "place name": "Florence",
    state: "South Carolina",
    "state abbreviation": "SC",
    latitude: "34.1954",
    longitude: "-79.7626"
  }]
});

assert.deepEqual(place, {
  postal_code: "29501",
  city: "Florence",
  state: "South Carolina",
  state_code: "SC",
  latitude: 34.1954,
  longitude: -79.7626
});

assert.throws(
  () => postalPlaceFromPayload("29501", { places: [{ "place name": "Florence" }] }),
  /invalid location data/i
);

console.log("Venue ZIP place normalization checks passed.");
