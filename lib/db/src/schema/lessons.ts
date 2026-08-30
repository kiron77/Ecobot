import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

/**
 * Lessons authored by admins. `content` holds the lesson body as markdown-ish
 * text; the structured metadata (level, minutes, category) drives the cards.
 */
export const lessonsTable = pgTable("lessons", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  category: text("category").notNull().default("Getting Started"),
  level: text("level").notNull().default("Beginner"),
  minutes: integer("minutes").notNull().default(10),
  content: text("content").notNull().default(""),
  published: integer("published").notNull().default(1), // 1 = visible, 0 = draft
  createdBy: text("created_by").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLessonSchema = createInsertSchema(lessonsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
