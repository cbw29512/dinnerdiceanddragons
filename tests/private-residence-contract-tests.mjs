import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { publicVenueLocation } from "../netlify/functions/_lib/venue-location-kind.mjs";

const residence = {
  name: "DM Home",
  location_kind: "private_residence",
  address_line1: "123 Secret Street",
  address_line2: null,
  city: "Florence",
  state_region: "SC",
  postal_code: "29501"
};

const before = publicVenueLocation(residence, { formed: false });
assert.equal(before.location_kind, "private_residence");
assert.equal(before.name, "Private residence");
assert.equal(before.address_line1, null);
assert.equal(before.postal_code, null);
assert.equal(before.city, "Florence");
assert.equal(before.state_region, "SC");

const after = publicVenueLocation(residence, { formed: true });
assert.equal(after.name, "DM Home");
assert.equal(after.address_line1, "123 Secret Street");
assert.equal(after.postal_code, "29501");

const business = publicVenueLocation({ ...residence, name: "Game Cafe", location_kind: "business" }, { formed: false });
assert.equal(business.name, "Game Cafe");
assert.equal(business.address_line1, null);

const hostHtml = await readFile(new URL("../host.html", import.meta.url), "utf8");
assert.match(hostHtml, /value="business"/);
assert.match(hostHtml, /value="private_residence"/);
assert.match(hostHtml, /exact street address is shown only after GAME ON/i);
assert.doesNotMatch(hostHtml, /approve each table booking/i);

const migration = await readFile(new URL("../netlify/database/migrations/0004_venue_location_kind.sql", import.meta.url), "utf8");
assert.match(migration, /private_residence/);
assert.match(migration, /DEFAULT 'business'/);

console.log("private residence contract tests passed");
