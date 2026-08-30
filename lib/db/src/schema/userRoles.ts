import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

/**
 * Role assignments, keyed by email (lowercased). Roles: "leadership",
 * "administrator", "moderator". Anyone not listed is a normal user.
 * The two seed Leadership emails are enforced in code (permissions.ts) so they
 * always have leadership even if this table is empty.
 */
export const userRolesTable = pgTable("user_roles", {
  email: text("email").primaryKey(),
  role: text("role").notNull(), // "leadership" | "administrator" | "moderator"
  grantedBy: text("granted_by").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserRoleSchema = createInsertSchema(userRolesTable).omit({
  updatedAt: true,
});
