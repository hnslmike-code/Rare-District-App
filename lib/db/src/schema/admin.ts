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
  ads: Array<{
    id: string;
    mediaType: "image" | "video";
    mediaUrl: string;
    href: string;
    alt: string;
    active: boolean;
    duration: number;
  }>;
  sections: {
    latest: boolean;
    editorial: boolean;
    designers: boolean;
  };
};

export type VendorJoinPageContent = {
  hero: {
    callLabel: string;
    eyebrow: string;
    intakeLabel: string;
    titleLine1: string;
    titleLine2: string;
    description: string;
    tags: string[];
  };
  brief: {
    kicker: string;
    headline: string;
    lookingForLabel: string;
    lookingFor: string[];
    note: string;
  };
  form: {
    eyebrow: string;
    title: string;
    progressLabel: string;
    contactLegend: string;
    contactAccent: string;
    fullNameLabel: string;
    fullNamePlaceholder: string;
    emailLabel: string;
    emailFallback: string;
    phoneLabel: string;
    phonePlaceholder: string;
    brandLegend: string;
    brandAccent: string;
    brandNameLabel: string;
    brandNamePlaceholder: string;
    categoryLabel: string;
    categoryPlaceholder: string;
    experienceLabel: string;
    experiencePlaceholder: string;
    bioLabel: string;
    bioPlaceholder: string;
    bioHint: string;
    proofLegend: string;
    proofAccent: string;
    socialLabel: string;
    socialPlaceholder: string;
    socialHint: string;
    samplesLabel: string;
    uploadTitle: string;
    uploadHint: string;
    uploadingLabel: string;
    uploadedSuffix: string;
    rules: {
      bioMinLength: number;
      minSamples: number;
      maxSamples: number;
      maxImageBytes: number;
    };
    submitLabel: string;
    submittingLabel: string;
    legal: string;
  };
  status: {
    pendingLabel: string;
    pendingTitle: string;
    pendingDescription: string;
    rejectedLabel: string;
    rejectedTitle: string;
    rejectedDescription: string;
    backLabel: string;
    backHref: string;
  };
  categoryOptions: Array<{ value: string; label: string }>;
  experienceOptions: Array<{ value: string; label: string }>;
  theme: {
    acid: string;
    pink: string;
    cyan: string;
    ink: string;
    backgroundStart: string;
    backgroundEnd: string;
    gridOpacity: string;
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

export const vendorJoinPageConfigsTable = pgTable("vendor_join_page_configs", {
  id: serial("id").primaryKey(),
  draftContent: jsonb("draft_content").$type<VendorJoinPageContent>().notNull(),
  publishedContent: jsonb("published_content").$type<VendorJoinPageContent>(),
  scheduledContent: jsonb("scheduled_content").$type<VendorJoinPageContent>(),
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
export type VendorJoinPageConfig = typeof vendorJoinPageConfigsTable.$inferSelect;
