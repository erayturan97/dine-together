import { boolean, integer, jsonb, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const groupRestaurantsTable = pgTable("group_restaurants", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull(),
  placeId: text("place_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address").notNull(),
  rating: real("rating"),
  reviewCount: integer("review_count"),
  priceLevel: integer("price_level"),
  photos: jsonb("photos").$type<string[]>().default([]),
  cuisine: varchar("cuisine", { length: 100 }),
  openNow: boolean("open_now"),
  distance: real("distance"),
  lat: real("lat"),
  lng: real("lng"),
  mapsUrl: text("maps_url"),
  menuItems: jsonb("menu_items").$type<Array<{name: string; description?: string; category: string; price?: string; photo?: string}>>().default([]),
  reviews: jsonb("reviews").$type<Array<{authorName: string; rating: number; text: string; timeAgo?: string; authorPhoto?: string}>>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const votesTable = pgTable("votes", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull(),
  userId: text("user_id").notNull(),
  restaurantId: text("restaurant_id").notNull(),
  liked: boolean("liked").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGroupRestaurantSchema = createInsertSchema(groupRestaurantsTable).omit({
  createdAt: true,
});

export const insertVoteSchema = createInsertSchema(votesTable).omit({
  createdAt: true,
});

export type InsertGroupRestaurant = z.infer<typeof insertGroupRestaurantSchema>;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type GroupRestaurant = typeof groupRestaurantsTable.$inferSelect;
export type Vote = typeof votesTable.$inferSelect;
