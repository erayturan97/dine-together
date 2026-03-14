import { integer, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const groupsTable = pgTable("groups", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  creatorId: text("creator_id").notNull(),
  venueType: varchar("venue_type", { length: 50 }).notNull().default("restaurant"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  lat: real("lat"),
  lng: real("lng"),
  radius: integer("radius"),
  locationName: text("location_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const groupMembersTable = pgTable("group_members", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull(),
  userId: text("user_id").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("invited"),
  doneAt: timestamp("done_at"),
  joinedAt: timestamp("joined_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGroupSchema = createInsertSchema(groupsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertGroupMemberSchema = createInsertSchema(groupMembersTable).omit({
  createdAt: true,
});

export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type InsertGroupMember = z.infer<typeof insertGroupMemberSchema>;
export type Group = typeof groupsTable.$inferSelect;
export type GroupMember = typeof groupMembersTable.$inferSelect;
