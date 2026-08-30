import { pgTable, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const userModulesTable = pgTable(
  "user_modules",
  {
    userId: text("user_id").notNull(),
    moduleId: text("module_id").notNull(),
    quantity: integer("quantity").notNull().default(1),
    notes: text("notes").notNull().default(""),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.moduleId] })],
);

export const insertUserModuleSchema = createInsertSchema(userModulesTable).omit({
  addedAt: true,
});
