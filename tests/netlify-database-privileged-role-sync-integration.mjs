import assert from "node:assert/strict";

import { syncPrivilegedIdentityRoles } from "../netlify/functions/_lib/auth.mjs";
import { eq, insertRows, selectOne } from "../netlify/functions/_lib/database.mjs";

const userId = "e1000000-0000-4000-8000-000000000001";
await insertRows("users", [{
  id: userId,
  auth_provider_user_id: "integration-privileged-role-sync",
  email: "privileged-role-sync@example.test",
  status: "active"
}], { returning: false });
await insertRows("user_roles", [{
  user_id: userId,
  role: "player",
  verified_at: null
}], { returning: false });

await syncPrivilegedIdentityRoles(userId, { roles: ["admin", "moderator", "player"] });
const grantedAdmin = await selectOne("user_roles", { user_id: eq(userId), role: eq("admin") }, { required: true });
const grantedModerator = await selectOne("user_roles", { user_id: eq(userId), role: eq("moderator") }, { required: true });
assert.ok(grantedAdmin.verified_at);
assert.ok(grantedModerator.verified_at);
assert.ok(await selectOne("user_roles", { user_id: eq(userId), role: eq("player") }));

await syncPrivilegedIdentityRoles(userId, { roles: ["moderator"] });
assert.equal(await selectOne("user_roles", { user_id: eq(userId), role: eq("admin") }), null);
assert.ok(await selectOne("user_roles", { user_id: eq(userId), role: eq("moderator") }));
assert.ok(await selectOne("user_roles", { user_id: eq(userId), role: eq("player") }));

await syncPrivilegedIdentityRoles(userId, { roles: [] });
assert.equal(await selectOne("user_roles", { user_id: eq(userId), role: eq("admin") }), null);
assert.equal(await selectOne("user_roles", { user_id: eq(userId), role: eq("moderator") }), null);
assert.ok(await selectOne("user_roles", { user_id: eq(userId), role: eq("player") }));

console.log("Privileged Identity role grant/revocation reconciliation checks passed.");
