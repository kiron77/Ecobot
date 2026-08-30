import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const userCartTable = pgTable(
  "user_cart",
  {
    userId: text("user_id").notNull(),
    moduleId: text("module_id").notNull(),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.moduleId] })],
);
