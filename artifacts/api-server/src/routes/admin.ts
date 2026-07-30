import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, usersTable, vendorsTable, productsTable, ordersTable, transactionsTable, adminSettingsTable, payoutRecordsTable } from "@workspace/db";
import {
  UpdateVendorStatusParams, UpdateVendorStatusBody,
  ListAdminVendorsQueryParams, ListAdminProductsQueryParams, ListAdminOrdersQueryParams,
  ListTransactionsQueryParams, MarkVendorPayoutParams, MarkVendorPayoutBody,
  UpdateAdminSettingsBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

function formatVendor(v: typeof vendorsTable.$inferSelect, user?: typeof usersTable.$inferSelect) {
  return {
    id: v.id, userId: v.userId, brandName: v.brandName, description: v.description,
    logoUrl: v.logoUrl, website: v.website, bankName: v.bankName,
    accountNumber: v.accountNumber, accountName: v.accountName, status: v.status,
    commissionRateOverride: v.commissionRateOverride ? parseFloat(v.commissionRateOverride) : null,
    payoutBalance: parseFloat(v.payoutBalance ?? "0"), adminNote: v.adminNote, createdAt: v.createdAt,
    user: user ? { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, referralCode: user.referralCode, referredBy: user.referredBy, createdAt: user.createdAt } : undefined,
  };
}

// GET /admin/stats
router.get("/admin/stats", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const [
    [{ total: totalUsers }],
    [{ total: totalVendors }],
    [{ total: approvedVendors }],
    [{ total: pendingVendors }],
    [{ total: totalProducts }],
    [{ total: totalOrders }],
    [{ revenue }],
    [{ commission }],
    recentOrders,
  ] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(usersTable),
    db.select({ total: sql<number>`count(*)` }).from(vendorsTable),
    db.select({ total: sql<number>`count(*)` }).from(vendorsTable).where(eq(vendorsTable.status, "approved")),
    db.select({ total: sql<number>`count(*)` }).from(vendorsTable).where(eq(vendorsTable.status, "pending")),
    db.select({ total: sql<number>`count(*)` }).from(productsTable),
    db.select({ total: sql<number>`count(*)` }).from(ordersTable),
    db.select({ revenue: sql<number>`coalesce(sum(amount), 0)` }).from(transactionsTable).where(eq(transactionsTable.status, "success")),
    db.select({ commission: sql<number>`coalesce(sum(commission_amount), 0)` }).from(transactionsTable).where(eq(transactionsTable.status, "success")),
    db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(5),
  ]);

  res.json({
    totalUsers: Number(totalUsers), totalVendors: Number(totalVendors),
    approvedVendors: Number(approvedVendors), pendingVendors: Number(pendingVendors),
    totalProducts: Number(totalProducts), totalOrders: Number(totalOrders),
    totalRevenue: Number(revenue), platformCommission: Number(commission),
    recentOrders: recentOrders.map(o => ({
      id: o.id, userId: o.userId, status: o.status,
      totalAmount: parseFloat(o.totalAmount), discountAmount: parseFloat(o.discountAmount ?? "0"),
      currency: o.currency, shippingAddress: o.shippingAddress,
      shippingCity: o.shippingCity, shippingState: o.shippingState,
      shippingPhone: o.shippingPhone, couponCode: o.couponCode,
      paymentProcessor: o.paymentProcessor, paymentReference: o.paymentReference,
      createdAt: o.createdAt, items: [],
    })),
    monthlySales: [],
  });
});

// GET /admin/settings
router.get("/admin/settings", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const [settings] = await db.select().from(adminSettingsTable);
  if (!settings) {
    const [created] = await db.insert(adminSettingsTable).values({}).returning();
    res.json({ id: created.id, defaultCommissionRate: parseFloat(created.defaultCommissionRate), referralRewardType: created.referralRewardType, referralRewardValue: parseFloat(created.referralRewardValue), shareRewardType: created.shareRewardType, shareRewardValue: parseFloat(created.shareRewardValue), updatedAt: created.updatedAt });
    return;
  }
  res.json({ id: settings.id, defaultCommissionRate: parseFloat(settings.defaultCommissionRate), referralRewardType: settings.referralRewardType, referralRewardValue: parseFloat(settings.referralRewardValue), shareRewardType: settings.shareRewardType, shareRewardValue: parseFloat(settings.shareRewardValue), updatedAt: settings.updatedAt });
});

// PATCH /admin/settings
router.patch("/admin/settings", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = UpdateAdminSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.defaultCommissionRate != null) updates.defaultCommissionRate = String(parsed.data.defaultCommissionRate);
  if (parsed.data.referralRewardType != null) updates.referralRewardType = parsed.data.referralRewardType;
  if (parsed.data.referralRewardValue != null) updates.referralRewardValue = String(parsed.data.referralRewardValue);
  if (parsed.data.shareRewardType != null) updates.shareRewardType = parsed.data.shareRewardType;
  if (parsed.data.shareRewardValue != null) updates.shareRewardValue = String(parsed.data.shareRewardValue);

  let settings = (await db.select().from(adminSettingsTable))[0];
  if (!settings) {
    [settings] = await db.insert(adminSettingsTable).values({}).returning();
  }
  const [updated] = await db.update(adminSettingsTable).set(updates).where(eq(adminSettingsTable.id, settings.id)).returning();
  res.json({ id: updated.id, defaultCommissionRate: parseFloat(updated.defaultCommissionRate), referralRewardType: updated.referralRewardType, referralRewardValue: parseFloat(updated.referralRewardValue), shareRewardType: updated.shareRewardType, shareRewardValue: parseFloat(updated.shareRewardValue), updatedAt: updated.updatedAt });
});

// GET /admin/vendors
router.get("/admin/vendors", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = ListAdminVendorsQueryParams.safeParse(req.query);
  const status = parsed.success ? parsed.data.status : undefined;
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;
  const page = parsed.success ? (parsed.data.page ?? 1) : 1;
  const offset = (page - 1) * limit;

  let vendors;
  if (status) {
    vendors = await db.select().from(vendorsTable).where(eq(vendorsTable.status, status as "pending" | "approved" | "rejected")).orderBy(desc(vendorsTable.createdAt)).limit(limit).offset(offset);
  } else {
    vendors = await db.select().from(vendorsTable).orderBy(desc(vendorsTable.createdAt)).limit(limit).offset(offset);
  }

  const result = await Promise.all(vendors.map(async (v) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, v.userId));
    return formatVendor(v, user);
  }));
  res.json(result);
});

// PATCH /admin/vendors/:id/status
router.patch("/admin/vendors/:id/status", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const paramsParsed = UpdateVendorStatusParams.safeParse({ id });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid vendor id" });
    return;
  }
  const parsed = UpdateVendorStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [vendor] = await db.update(vendorsTable)
    .set({ status: parsed.data.status, adminNote: parsed.data.adminNote ?? null })
    .where(eq(vendorsTable.id, paramsParsed.data.id)).returning();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, vendor.userId));
  res.json(formatVendor(vendor, user));
});

// GET /admin/products
router.get("/admin/products", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = ListAdminProductsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;
  const page = parsed.success ? (parsed.data.page ?? 1) : 1;
  const offset = (page - 1) * limit;
  const vendorId = parsed.success ? parsed.data.vendorId : undefined;

  let products;
  if (vendorId) {
    products = await db.select().from(productsTable).where(eq(productsTable.vendorId, vendorId)).orderBy(desc(productsTable.createdAt)).limit(limit).offset(offset);
  } else {
    products = await db.select().from(productsTable).orderBy(desc(productsTable.createdAt)).limit(limit).offset(offset);
  }

  res.json(products.map(p => ({
    id: p.id, vendorId: p.vendorId, name: p.name, description: p.description,
    price: parseFloat(p.price), currency: p.currency, category: p.category,
    sizes: p.sizes, images: p.images, stock: p.stock, isActive: p.isActive,
    isFeatured: p.isFeatured, wardrobeCount: p.wardrobeCount,
    averageRating: null, reviewCount: 0, createdAt: p.createdAt,
  })));
});

// GET /admin/orders
router.get("/admin/orders", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = ListAdminOrdersQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;
  const page = parsed.success ? (parsed.data.page ?? 1) : 1;
  const offset = (page - 1) * limit;

  const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(limit).offset(offset);
  res.json(orders.map(o => ({
    id: o.id, userId: o.userId, status: o.status,
    totalAmount: parseFloat(o.totalAmount), discountAmount: parseFloat(o.discountAmount ?? "0"),
    currency: o.currency, shippingAddress: o.shippingAddress,
    shippingCity: o.shippingCity, shippingState: o.shippingState,
    shippingPhone: o.shippingPhone, couponCode: o.couponCode,
    paymentProcessor: o.paymentProcessor, paymentReference: o.paymentReference,
    createdAt: o.createdAt, items: [],
  })));
});

// GET /admin/transactions
router.get("/admin/transactions", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;
  const page = parsed.success ? (parsed.data.page ?? 1) : 1;
  const offset = (page - 1) * limit;

  const txs = await db.select().from(transactionsTable).orderBy(desc(transactionsTable.createdAt)).limit(limit).offset(offset);
  res.json(txs.map(t => ({
    id: t.id, orderId: t.orderId, buyerId: t.buyerId, vendorId: t.vendorId,
    amount: parseFloat(t.amount), commissionRate: parseFloat(t.commissionRate),
    commissionAmount: parseFloat(t.commissionAmount), vendorAmount: parseFloat(t.vendorAmount),
    processor: t.processor, reference: t.reference, status: t.status, createdAt: t.createdAt,
  })));
});

// POST /admin/vendors/:id/payout
router.post("/admin/vendors/:id/payout", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const paramsParsed = MarkVendorPayoutParams.safeParse({ id });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid vendor id" });
    return;
  }
  const parsed = MarkVendorPayoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const amount = parsed.data.amount;

  // Deduct from vendor payout balance
  await db.execute(sql`UPDATE vendors SET payout_balance = GREATEST(0, payout_balance - ${amount}) WHERE id = ${paramsParsed.data.id}`);

  const [record] = await db.insert(payoutRecordsTable).values({
    vendorId: paramsParsed.data.id,
    amount: String(amount),
    note: parsed.data.note ?? null,
  }).returning();

  res.json({
    id: record.id, vendorId: record.vendorId,
    amount: parseFloat(record.amount), note: record.note, createdAt: record.createdAt,
  });
});

export default router;
