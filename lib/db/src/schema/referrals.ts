import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { couponsTable } from "./coupons";
import { productsTable } from "./products";

export const referralStatusEnum = pgEnum("referral_status", ["pending", "completed"]);
export const rewardTypeEnum = pgEnum("reward_type", ["referral_signup", "referral_purchase", "share_purchase"]);
export const rewardStatusEnum = pgEnum("reward_status", ["pending", "issued", "redeemed"]);

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: serial("referrer_id").notNull().references(() => usersTable.id),
  referredId: serial("referred_id").notNull().references(() => usersTable.id),
  status: referralStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rewardsTable = pgTable("rewards", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull().references(() => usersTable.id),
  type: rewardTypeEnum("type").notNull(),
  couponId: integer("coupon_id").references(() => couponsTable.id),
  status: rewardStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shareLinksTable = pgTable("share_links", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull().references(() => usersTable.id),
  productId: serial("product_id").notNull().references(() => productsTable.id),
  shareCode: text("share_code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReferralSchema = createInsertSchema(referralsTable).omit({ id: true, createdAt: true });
export const insertRewardSchema = createInsertSchema(rewardsTable).omit({ id: true, createdAt: true });
export const insertShareLinkSchema = createInsertSchema(shareLinksTable).omit({ id: true, createdAt: true });
export type Referral = typeof referralsTable.$inferSelect;
export type Reward = typeof rewardsTable.$inferSelect;
export type ShareLink = typeof shareLinksTable.$inferSelect;
