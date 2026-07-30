import { pgTable, serial, timestamp, numeric, text, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rewardTypeConfigEnum = pgEnum("reward_type_config", ["percentage", "fixed"]);

export const adminSettingsTable = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  defaultCommissionRate: numeric("default_commission_rate", { precision: 5, scale: 2 }).notNull().default("5"),
  referralRewardType: text("referral_reward_type").notNull().default("fixed"),
  referralRewardValue: numeric("referral_reward_value", { precision: 10, scale: 2 }).notNull().default("500"),
  shareRewardType: text("share_reward_type").notNull().default("fixed"),
  shareRewardValue: numeric("share_reward_value", { precision: 10, scale: 2 }).notNull().default("250"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAdminSettingsSchema = createInsertSchema(adminSettingsTable).omit({ id: true });
export type InsertAdminSettings = z.infer<typeof insertAdminSettingsSchema>;
export type AdminSettings = typeof adminSettingsTable.$inferSelect;
