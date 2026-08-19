import { pgEnum, pgTable, serial, integer, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const mediaOwnerTypeEnum = pgEnum("media_owner_type", ["user", "vendor", "product", "review", "conversation", "return", "admin"]);
export const mediaVisibilityEnum = pgEnum("media_visibility", ["private", "public"]);
export const mediaStatusEnum = pgEnum("media_status", ["awaiting_upload", "processing", "ready", "flagged", "failed", "deleted"]);
export const mediaModerationStatusEnum = pgEnum("media_moderation_status", ["pending", "clear", "flagged", "approved", "rejected"]);
export const mediaDerivativeKindEnum = pgEnum("media_derivative_kind", ["thumbnail", "card", "gallery", "square", "portrait"]);

export const mediaAssetsTable = pgTable("media_assets", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull(),
  ownerType: mediaOwnerTypeEnum("owner_type").notNull(),
  surface: text("surface").notNull(),
  visibility: mediaVisibilityEnum("visibility").notNull().default("private"),
  status: mediaStatusEnum("status").notNull().default("awaiting_upload"),
  activeVersionId: integer("active_version_id"),
  altText: text("alt_text"),
  originalName: text("original_name").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const mediaVersionsTable = pgTable("media_versions", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(),
  version: integer("version").notNull(),
  sourceObjectPath: text("source_object_path").notNull(),
  contentType: text("content_type").notNull(),
  bytes: integer("bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  processingError: text("processing_error"),
  originalExpiresAt: timestamp("original_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mediaDerivativesTable = pgTable("media_derivatives", {
  id: serial("id").primaryKey(),
  versionId: integer("version_id").notNull(),
  kind: mediaDerivativeKindEnum("kind").notNull(),
  objectPath: text("object_path").notNull(),
  contentType: text("content_type").notNull().default("image/webp"),
  bytes: integer("bytes").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mediaPlacementsTable = pgTable("media_placements", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  slot: text("slot"),
  sortOrder: integer("sort_order").notNull().default(0),
  focalX: integer("focal_x"),
  focalY: integer("focal_y"),
  cropShape: text("crop_shape"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mediaModerationTable = pgTable("media_moderation", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(),
  status: mediaModerationStatusEnum("status").notNull().default("pending"),
  flags: jsonb("flags").$type<string[]>().notNull().default([]),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});