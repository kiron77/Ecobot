import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tutorConversationsTable = pgTable("tutor_conversations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  title: text("title").notNull(),
  projectId: integer("project_id"),
  workflowStage: text("workflow_stage").notNull().default("observe"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tutorMessagesTable = pgTable("tutor_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTutorConversationSchema = createInsertSchema(tutorConversationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertTutorMessageSchema = createInsertSchema(tutorMessagesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertTutorConversation = z.infer<typeof insertTutorConversationSchema>;
export type TutorConversation = typeof tutorConversationsTable.$inferSelect;
export type InsertTutorMessage = z.infer<typeof insertTutorMessageSchema>;
export type TutorMessage = typeof tutorMessagesTable.$inferSelect;
