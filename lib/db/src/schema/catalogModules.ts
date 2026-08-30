import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

/**
 * The EcoBot hardware module catalog, admin-editable. `sensors` is stored as a
 * comma-separated string for simplicity. Seeded once from the historical
 * static catalog (see seedCatalog in the admin routes) so nothing is lost.
 */
export const catalogModulesTable = pgTable("catalog_modules", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().default(""),      // stable id like "ultrasonic-hcsr04"
  group: text("group").notNull().default("Modules"),
  displayName: text("display_name").notNull(),
  model: text("model").notNull().default(""),
  description: text("description").notNull().default(""),
  sensors: text("sensors").notNull().default(""), // comma-separated
  pinHints: text("pin_hints").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCatalogModuleSchema = createInsertSchema(catalogModulesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
