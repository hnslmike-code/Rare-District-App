import { pgTable, serial, timestamp, numeric, text, jsonb, integer, pgEnum } from "drizzle-orm/pg-core";
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

export type HomepageContent = {
  hero: {
    eyebrow: string;
    title: string;
    accent: string;
    description: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
    release: string;
    visualLabel: string;
    location: string;
    proof: string[];
    productIds: number[];
  };
  carousel: {
    title: string;
    eyebrow: string;
    productIds: number[];
    autoplay: boolean;
  };
  sections: {
    latest: boolean;
    editorial: boolean;
    designers: boolean;
  };
};

export const homepageConfigsTable = pgTable("homepage_configs", {
  id: serial("id").primaryKey(),
  draftContent: jsonb("draft_content").$type<HomepageContent>().notNull(),
  publishedContent: jsonb("published_content").$type<HomepageContent>(),
  scheduledContent: jsonb("scheduled_content").$type<HomepageContent>(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  updatedBy: integer("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const adminAuditLogsTable = pgTable("admin_audit_logs", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdminSettingsSchema = createInsertSchema(adminSettingsTable).omit({ id: true });
export type InsertAdminSettings = z.infer<typeof insertAdminSettingsSchema>;
export type AdminSettings = typeof adminSettingsTable.$inferSelect;
export type HomepageConfig = typeof homepageConfigsTable.$inferSelect;
