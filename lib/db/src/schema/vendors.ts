import { pgTable, text, serial, timestamp, numeric, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const vendorStatusEnum = pgEnum("vendor_status", ["pending", "approved", "rejected"]);

export const vendorsTable = pgTable("vendors", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull().references(() => usersTable.id),
  brandName: text("brand_name").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  description: text("description"),
  category: text("category"),
  experienceLevel: text("experience_level"),
  socialLink: text("social_link"),
  sampleImages: text("sample_images").array().notNull().default([]),
  logoUrl: text("logo_url"),
  website: text("website"),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  accountName: text("account_name"),
  status: vendorStatusEnum("status").notNull().default("pending"),
  commissionRateOverride: numeric("commission_rate_override", { precision: 5, scale: 2 }),
  payoutBalance: numeric("payout_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  shippingRegions: text("shipping_regions").array().notNull().default([]),
  processingDays: integer("processing_days").notNull().default(5),
  returnWindowDays: integer("return_window_days").notNull().default(14),
  returnConditions: text("return_conditions"),
  cancellationPolicy: text("cancellation_policy"),
  notificationPreferences: jsonb("notification_preferences").$type<Record<string, boolean>>().notNull().default({}),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertVendorSchema = createInsertSchema(vendorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendorsTable.$inferSelect;
