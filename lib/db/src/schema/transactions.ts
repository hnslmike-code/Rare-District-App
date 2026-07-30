import { pgTable, serial, timestamp, numeric, integer, text, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";
import { usersTable } from "./users";
import { vendorsTable } from "./vendors";

export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "success", "failed"]);

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  orderId: serial("order_id").notNull().references(() => ordersTable.id),
  buyerId: serial("buyer_id").notNull().references(() => usersTable.id),
  vendorId: serial("vendor_id").notNull().references(() => vendorsTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull(),
  commissionAmount: numeric("commission_amount", { precision: 12, scale: 2 }).notNull(),
  vendorAmount: numeric("vendor_amount", { precision: 12, scale: 2 }).notNull(),
  processor: text("processor").notNull(),
  reference: text("reference"),
  status: transactionStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payoutRecordsTable = pgTable("payout_records", {
  id: serial("id").primaryKey(),
  vendorId: serial("vendor_id").notNull().references(() => vendorsTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export const insertPayoutRecordSchema = createInsertSchema(payoutRecordsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
export type PayoutRecord = typeof payoutRecordsTable.$inferSelect;
