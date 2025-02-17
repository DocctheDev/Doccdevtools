import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const bots = pgTable("bots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  token: text("token").notNull(),
  isActive: boolean("is_active").default(false),
});

export const commands = pgTable("commands", {
  id: serial("id").primaryKey(),
  botId: integer("bot_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  code: text("code").notNull(),
});

export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  botId: integer("bot_id").notNull(),
  metrics: jsonb("metrics").notNull(),
  timestamp: text("timestamp").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertBotSchema = createInsertSchema(bots).pick({
  name: true,
  token: true,
});

export const insertCommandSchema = createInsertSchema(commands).pick({
  name: true,
  description: true,
  code: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Bot = typeof bots.$inferSelect;
export type Command = typeof commands.$inferSelect;
export type Analytics = typeof analytics.$inferSelect;
