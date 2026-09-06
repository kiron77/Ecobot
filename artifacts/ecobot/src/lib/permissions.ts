import { getAuth, clerkClient } from "@clerk/express";
import type { Request } from "express";
import { db, userRolesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { DEV_USER_ID } from "../middlewares/devAuthMiddleware";

/**
 * Role model:
 *   leadership   — full content control + manage everyone's roles (not self-demote)
 *   administrator — add/edit/delete lessons & modules; no role management
 *   moderator    — placeholder for future community features; no powers yet
 *   user         — everyone else
 *
 * The two SEED_LEADERS always resolve to leadership, even if the DB is empty,
 * so there is always a way back in.
 */
export type Role = "leadership" | "administrator" | "moderator" | "user";

export const SEED_LEADERS = [
  "kiron77@gmail.com",
  "elikmath@icloud.com",
].map((e) => e.toLowerCase());

// In local dev (DEV_AUTH_BYPASS), treat the fake user as this email so you can
// exercise the leadership UI without Clerk. Overridable via env.
const DEV_EMAIL = (process.env.DEV_USER_EMAIL || "kiron77@gmail.com").toLowerCase();

/** Get the signed-in user's email (lowercased), or null. */
export async function getUserEmail(req: Request): Promise<string | null> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return null;

  // Dev bypass: no real Clerk user exists, so use the configured dev email.
  if (userId === DEV_USER_ID) return DEV_EMAIL;

  // Try session claims first (cheap), then fall back to the Clerk API.
  const claimEmail = (auth?.sessionClaims as { email?: string } | undefined)?.email;
  if (claimEmail) return claimEmail.toLowerCase();

  try {
    const user = await clerkClient.users.getUser(userId);
    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses?.[0]?.emailAddress ??
      null;
    return email ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Resolve a user's role from the seed list + DB. */
export async function getRoleForEmail(email: string | null): Promise<Role> {
  if (!email) return "user";
  const e = email.toLowerCase();
  if (SEED_LEADERS.includes(e)) return "leadership";
  try {
    const rows = await db
      .select()
      .from(userRolesTable)
      .where(eq(userRolesTable.email, e))
      .limit(1);
    const role = rows[0]?.role as Role | undefined;
    if (role === "leadership" || role === "administrator" || role === "moderator") {
      return role;
    }
  } catch {
    /* ignore — default to user */
  }
  return "user";
}

/** Convenience: resolve the current request's role. */
export async function getRequestRole(req: Request): Promise<{ email: string | null; role: Role }> {
  const email = await getUserEmail(req);
  const role = await getRoleForEmail(email);
  return { email, role };
}

export function canManageContent(role: Role): boolean {
  return roleRank(role) >= roleRank("administrator");
}

export function canManageRoles(role: Role): boolean {
  return roleRank(role) >= roleRank("leadership");
}

/**
 * Cumulative role hierarchy: a higher rank can do everything every lower rank
 * can, plus its own extra powers. New powers should be gated with
 * `roleRank(role) >= roleRank("<minimum role>")` so the hierarchy always holds.
 *
 *   leadership (3)   — everything: content + role management
 *   administrator (2) — add/edit/delete lessons & modules
 *   moderator (1)    — no powers yet (reserved for community/sharing features)
 *   user (0)         — normal user
 */
export function roleRank(role: Role): number {
  switch (role) {
    case "leadership": return 3;
    case "administrator": return 2;
    case "moderator": return 1;
    default: return 0;
  }
}
