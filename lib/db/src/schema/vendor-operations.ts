import { pgTable, serial, integer, numeric, text, timestamp, boolean, jsonb, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { vendorsTable } from "./vendors";
import { ordersTable, orderItemsTable } from "./orders";
import { usersTable } from "./users";

export const inventoryReservationStatusEnum = pgEnum("inventory_reservation_status", ["active", "released", "consumed", "expired"]);
export const returnStatusEnum = pgEnum("return_status", ["requested", "approved", "rejected", "awaiting_item", "received", "inspected", "refunded", "cancelled", "disputed"]);
export const returnReasonEnum = pgEnum("return_reason", ["wrong_item", "damaged"]);
export const returnShippingDecisionEnum = pgEnum("return_shipping_decision", ["vendor", "customer", "shared", "undecided"]);
export const returnShippingProposalStatusEnum = pgEnum("return_shipping_proposal_status", ["proposed", "accepted", "declined", "countered"]);
export const notificationTypeEnum = pgEnum("notification_type", ["order", "return", "inventory", "payout", "system"]);

export const productVariantsTable = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: serial("product_id").notNull().references(() => productsTable.id),
  sku: text("sku").notNull(),
  attributes: jsonb("attributes").$type<Record<string, string>>().notNull().default({}),
  priceAdjustment: numeric("price_adjustment", { precision: 12, scale: 2 }).notNull().default("0"),
  stock: integer("stock").notNull().default(0),
  reservedStock: integer("reserved_stock").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(2),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  productSkuUnique: uniqueIndex("product_variants_product_sku_unique").on(table.productId, table.sku),
}));

export const inventoryAdjustmentTable = pgTable("inventory_adjustments", {
  id: serial("id").primaryKey(),
  vendorId: serial("vendor_id").notNull().references(() => vendorsTable.id),
  productId: serial("product_id").notNull().references(() => productsTable.id),
  variantId: integer("variant_id").references(() => productVariantsTable.id),
  quantityChange: integer("quantity_change").notNull(),
  reason: text("reason").notNull(),
  note: text("note"),
  createdBy: serial("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inventoryReservationTable = pgTable("inventory_reservations", {
  id: serial("id").primaryKey(),
  orderId: serial("order_id").notNull().references(() => ordersTable.id),
  orderItemId: serial("order_item_id").notNull().references(() => orderItemsTable.id),
  productId: serial("product_id").notNull().references(() => productsTable.id),
  variantId: integer("variant_id").references(() => productVariantsTable.id),
  quantity: integer("quantity").notNull(),
  status: inventoryReservationStatusEnum("status").notNull().default("active"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const returnsTable = pgTable("returns", {
  id: serial("id").primaryKey(),
  orderId: serial("order_id").notNull().references(() => ordersTable.id),
  orderItemId: serial("order_item_id").notNull().references(() => orderItemsTable.id),
  customerId: serial("customer_id").notNull().references(() => usersTable.id),
  vendorId: serial("vendor_id").notNull().references(() => vendorsTable.id),
  reason: returnReasonEnum("reason").notNull(),
  description: text("description"),
  status: returnStatusEnum("status").notNull().default("requested"),
  shippingDecision: returnShippingDecisionEnum("shipping_decision").notNull().default("undecided"),
  shippingAgreementProposalId: integer("shipping_agreement_proposal_id"),
  shippingInstructions: text("shipping_instructions"),
  responseDeadline: timestamp("response_deadline").notNull(),
  refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  resolutionNote: text("resolution_note"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  inspectedAt: timestamp("inspected_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
});

export const returnMessagesTable = pgTable("return_messages", {
  id: serial("id").primaryKey(),
  returnId: serial("return_id").notNull().references(() => returnsTable.id),
  senderId: serial("sender_id").notNull().references(() => usersTable.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const returnShippingProposalsTable = pgTable("return_shipping_proposals", {
  id: serial("id").primaryKey(),
  returnId: serial("return_id").notNull().references(() => returnsTable.id),
  parentProposalId: integer("parent_proposal_id"),
  proposedBy: serial("proposed_by").notNull().references(() => usersTable.id),
  payer: returnShippingDecisionEnum("payer").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  instructions: text("instructions"),
  note: text("note"),
  status: returnShippingProposalStatusEnum("status").notNull().default("proposed"),
  respondedBy: integer("responded_by").references(() => usersTable.id),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const returnAuditEventsTable = pgTable("return_audit_events", {
  id: serial("id").primaryKey(),
  returnId: serial("return_id").notNull().references(() => returnsTable.id),
  actorId: integer("actor_id").references(() => usersTable.id),
  action: text("action").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull().references(() => usersTable.id),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  href: text("href"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});