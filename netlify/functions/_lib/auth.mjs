import { getUser, refreshSession } from "@netlify/identity";
import {
  SupabaseRestError,
  eq,
  insertRows,
  selectMany,
  selectOne,
  updateRows
} from "./supabase-rest.mjs";

const PRIVILEGED_IDENTITY_ROLES = new Set(["moderator", "admin"]);

function canonicalEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email || !email.includes("@")) throw new SupabaseRestError("Authenticated identity is incomplete.", 401);
  return email;
}

async function identityUser() {
  try {
    await refreshSession();
  } catch (error) {
    // An absent/expired anonymous session is handled as a normal 401 below. Only
    // surface provider failures when Identity itself is unavailable.
    if (String(error?.name || "") === "MissingIdentityError") {
      throw new SupabaseRestError("Netlify Identity is not enabled for this project.", 503);
    }
  }
  const user = await getUser();
  if (!user?.id || !user?.email) throw new SupabaseRestError("An authenticated session is required.", 401);
  return user;
}

async function syncPrivilegedIdentityRoles(userId, authUser) {
  const now = new Date().toISOString();
  for (const role of Array.isArray(authUser.roles) ? authUser.roles : []) {
    if (!PRIVILEGED_IDENTITY_ROLES.has(role)) continue;
    await insertRows("user_roles", [{ user_id: userId, role, verified_at: now }], {
      upsert: true,
      onConflict: "user_id,role",
      returning: false
    });
  }
}

export async function currentUser(_request, { active = false } = {}) {
  const authUser = await identityUser();
  const subject = String(authUser.id || "").trim();
  const email = canonicalEmail(authUser.email);
  const now = new Date().toISOString();

  let user = await selectOne("users", { auth_provider_user_id: eq(subject) });
  if (!user) {
    const emailOwner = await selectOne("users", { email: eq(email) });
    if (emailOwner) throw new SupabaseRestError("This sign-in could not be safely linked to a DDD account.", 409);
    try {
      const created = await insertRows("users", [{
        id: crypto.randomUUID(),
        auth_provider_user_id: subject,
        email,
        email_verified_at: now,
        display_name: authUser.name || null,
        display_name_normalized: authUser.name ? String(authUser.name).trim().toLowerCase() : null,
        status: "active",
        last_login_at: now,
        updated_at: now
      }]);
      user = Array.isArray(created) ? created[0] : null;
    } catch (error) {
      user = await selectOne("users", { auth_provider_user_id: eq(subject) });
      if (!user) throw error;
    }
  } else {
    if (String(user.email || "").toLowerCase() !== email) {
      const emailOwner = await selectOne("users", { email: eq(email) });
      if (emailOwner && emailOwner.id !== user.id) {
        throw new SupabaseRestError("This sign-in could not be safely linked to a DDD account.", 409);
      }
    }
    const nextStatus = user.status === "pending_verification" ? "active" : user.status;
    const updated = await updateRows("users", { id: eq(user.id) }, {
      email,
      email_verified_at: user.email_verified_at || now,
      last_login_at: now,
      updated_at: now,
      status: nextStatus
    });
    user = Array.isArray(updated) && updated[0] ? updated[0] : { ...user, email, last_login_at: now, status: nextStatus };
  }

  await syncPrivilegedIdentityRoles(user.id, authUser);

  if (active && user.status !== "active") {
    throw new SupabaseRestError("Account is not permitted to participate.", 403);
  }
  return { authUser, user };
}

export async function userRoles(userId) {
  const rows = await selectMany("user_roles", { user_id: eq(userId), order: "role.asc" });
  return rows.map((row) => row.role);
}

export async function requireRole(userId, role) {
  const row = await selectOne("user_roles", { user_id: eq(userId), role: eq(role) });
  if (!row) throw new SupabaseRestError("This account does not have permission for this action.", 403);
  return row;
}

export async function ensureRole(userId, role, { verified = false } = {}) {
  const now = new Date().toISOString();
  await insertRows("user_roles", [{
    user_id: userId,
    role,
    verified_at: verified ? now : null
  }], { upsert: true, onConflict: "user_id,role", returning: false });
}

export async function managedVenue(userId, venueId, { verified = true } = {}) {
  const manager = await selectOne("venue_managers", {
    user_id: eq(userId),
    venue_id: eq(venueId)
  });
  if (!manager || (verified && !manager.verified_at)) {
    throw new SupabaseRestError("This account is not a verified manager for that Venue.", 403);
  }
  return manager;
}

export function publicCurrentUser(user) {
  return {
    ddd_user_id: user.id,
    auth_provider: "netlify_identity",
    auth_provider_user_id: user.auth_provider_user_id,
    email: user.email,
    display_name: user.display_name || null,
    status: user.status
  };
}
