import { pgTable, serial, timestamp, numeric, integer, text, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable, orderItemsTable } from "./orders";
import { usersTable } from "./users";
import { vendorsTable } from "./vendors";

export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "success", "failed"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["sale", "refund", "reversal"]);
export const payoutStatusEnum = pgEnum("payout_status", ["pending", "approved", "paid", "failed", "reversed"]);

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  orderId: serial("order_id").notNull().references(() => ordersTable.id),
  orderItemId: integer("order_item_id").references(() => orderItemsTable.id),
  buyerId: serial("buyer_id").notNull().references(() => usersTable.id),
  vendorId: serial("vendor_id").notNull().references(() => vendorsTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull(),
  commissionAmount: numeric("commission_amount", { precision: 12, scale: 2 }).notNull(),
  vendorAmount: numeric("vendor_amount", { precision: 12, scale: 2 }).notNull(),
  processor: text("processor").notNull(),
  reference: text("reference"),
  status: transactionStatusEnum("status").notNull().default("pending"),
  transactionType: transactionTypeEnum("transaction_type").notNull().default("sale"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // New ledger rows are item-linked. This is the database-level guard that
  // prevents a retry from creating a second sale/refund/reversal for that item.
  uniqueIndex("transactions_order_item_type_unique").on(table.orderItemId, table.transactionType),
]);

export const payoutRecordsTable = pgTable("payout_records", {
  id: serial("id").primaryKey(),
  vendorId: serial("vendor_id").notNull().references(() => vendorsTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  status: payoutStatusEnum("status").notNull().default("pending"),
  reference: text("reference"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export const insertPayoutRecordSchema = createInsertSchema(payoutRecordsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
export type PayoutRecord = typeof payoutRecordsTable.$inferSelect;
