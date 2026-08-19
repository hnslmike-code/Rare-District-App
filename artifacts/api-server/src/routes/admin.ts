import { Router, type IRouter } from "express";
import { and, eq, desc, sql, asc, gt, inArray } from "drizzle-orm";
import { db, usersTable, vendorsTable, productsTable, ordersTable, transactionsTable, adminSettingsTable, payoutRecordsTable, homepageConfigsTable, adminAuditLogsTable, categoriesTable, type HomepageContent } from "@workspace/db";
import {
  UpdateVendorStatusParams, UpdateVendorStatusBody,
  ListAdminVendorsQueryParams, ListAdminProductsQueryParams, ListAdminOrdersQueryParams,
  ListTransactionsQueryParams, MarkVendorPayoutParams, MarkVendorPayoutBody,
  UpdateAdminSettingsBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

function formatCsvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

const defaultHomepageContent: HomepageContent = {
  hero: {
    eyebrow: "Drop 01 / now live",
    title: "Wear the",
    accent: "next wave.",
    description: "The new names, rare pieces, and future-facing African fashion worth finding before everyone else does.",
    primaryLabel: "Shop new drop",
    primaryHref: "/shop?category=new",
    secondaryLabel: "Meet the designers",
    secondaryHref: "/shop?category=designers",
    release: "01",
    visualLabel: "Rare District\nFuture archive",
    location: "Lagos / Worldwide",
    proof: ["Independent labels", "Private releases", "Lagos to global"],
    productIds: [],
  },
  carousel: { eyebrow: "The district edit / 01", title: "Pieces with presence.", productIds: [], autoplay: true },
  sections: { latest: true, editorial: true, designers: true },
};

function isShortText(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function isProductIdList(value: unknown, max: number) {
  return Array.isArray(value) && value.length <= max && value.every(id => Number.isInteger(id) && id > 0);
}

function isHomepageContent(value: unknown): value is HomepageContent {
  if (!value || typeof value !== "object") return false;
  const content = value as HomepageContent;
  const hero = content.hero;
  const carousel = content.carousel;
  const sections = content.sections;
  return Boolean(
    hero && carousel && sections &&
    [hero.eyebrow, hero.title, hero.accent, hero.description, hero.primaryLabel, hero.secondaryLabel, hero.release, hero.visualLabel, hero.location].every(item => isShortText(item, 400)) &&
    isShortText(hero.primaryHref, 200) && hero.primaryHref.startsWith("/") &&
    isShortText(hero.secondaryHref, 200) && hero.secondaryHref.startsWith("/") &&
    Array.isArray(hero.proof) && hero.proof.length > 0 && hero.proof.length <= 4 && hero.proof.every(item => isShortText(item, 50)) &&
    isProductIdList(hero.productIds, 2) &&
    isShortText(carousel.eyebrow, 80) && isShortText(carousel.title, 100) && isProductIdList(carousel.productIds, 12) && typeof carousel.autoplay === "boolean" &&
    typeof sections.latest === "boolean" && typeof sections.editorial === "boolean" && typeof sections.designers === "boolean",
  );
}

async function getHomepageConfig() {
  const [existing] = await db.select().from(homepageConfigsTable).orderBy(asc(homepageConfigsTable.id)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(homepageConfigsTable).values({ draftContent: defaultHomepageContent }).returning();
  return created;
}

async function validateHomepageProducts(content: HomepageContent): Promise<string | null> {
  const selectedIds = [...new Set([...content.hero.productIds, ...content.carousel.productIds])];
  if (selectedIds.length === 0) return null;

  const publishable = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(and(inArray(productsTable.id, selectedIds), eq(productsTable.isActive, true), gt(productsTable.stock, 0)));
  const allowedIds = new Set(publishable.map(product => product.id));
  const unavailableIds = selectedIds.filter(id => !allowedIds.has(id));
  return unavailableIds.length ? `Selected product${unavailableIds.length > 1 ? "s are" : " is"} not publishable: ${unavailableIds.join(", ")}.` : null;
}

async function recordAudit(req: Parameters<typeof router.get>[1] extends (req: infer R, ...args: never[]) => unknown ? R : never, action: string, entityType: string, entityId?: string, detail?: string) {
  if (!req.user) return;
  await db.insert(adminAuditLogsTable).values({ adminUserId: req.user.userId, action, entityType, entityId: entityId ?? null, detail: detail ?? null });
}

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
  await recordAudit(req, "updated_settings", "settings", String(updated.id));
  res.json({ id: updated.id, defaultCommissionRate: parseFloat(updated.defaultCommissionRate), referralRewardType: updated.referralRewardType, referralRewardValue: parseFloat(updated.referralRewardValue), shareRewardType: updated.shareRewardType, shareRewardValue: parseFloat(updated.shareRewardValue), updatedAt: updated.updatedAt });
});

// GET /admin/homepage
router.get("/admin/homepage", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const config = await getHomepageConfig();
  res.json({
    id: config.id,
    draftContent: config.draftContent,
    publishedContent: config.publishedContent,
    scheduledContent: config.scheduledContent,
    scheduledAt: config.scheduledAt,
    publishedAt: config.publishedAt,
    updatedAt: config.updatedAt,
  });
});

// PATCH /admin/homepage
router.patch("/admin/homepage", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  if (!isHomepageContent(req.body)) {
    res.status(400).json({ error: "Homepage content is incomplete or invalid." });
    return;
  }
  const productValidationError = await validateHomepageProducts(req.body);
  if (productValidationError) {
    res.status(400).json({ error: productValidationError });
    return;
  }
  const config = await getHomepageConfig();
  const [updated] = await db.update(homepageConfigsTable)
    .set({ draftContent: req.body, updatedBy: req.user!.userId })
    .where(eq(homepageConfigsTable.id, config.id))
    .returning();
  await recordAudit(req, "saved_homepage_draft", "homepage", String(updated.id));
  res.json({ id: updated.id, draftContent: updated.draftContent, publishedContent: updated.publishedContent, scheduledContent: updated.scheduledContent, scheduledAt: updated.scheduledAt, publishedAt: updated.publishedAt, updatedAt: updated.updatedAt });
});

// POST /admin/homepage/publish
router.post("/admin/homepage/publish", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const payload = req.body as { mode?: unknown; scheduledAt?: unknown };
  if ((payload.mode !== "now" && payload.mode !== "schedule") || (payload.mode === "schedule" && typeof payload.scheduledAt !== "string")) {
    res.status(400).json({ error: "Choose publish now or provide a future schedule time." });
    return;
  }
  const config = await getHomepageConfig();
  const productValidationError = await validateHomepageProducts(config.draftContent);
  if (productValidationError) {
    res.status(400).json({ error: productValidationError });
    return;
  }
  const isScheduled = payload.mode === "schedule";
  const scheduledAt = isScheduled ? new Date(payload.scheduledAt as string) : null;
  if (scheduledAt && (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date())) {
    res.status(400).json({ error: "Scheduled publish time must be in the future." });
    return;
  }
  const [updated] = await db.update(homepageConfigsTable)
    .set(isScheduled
      ? { scheduledContent: config.draftContent, scheduledAt, updatedBy: req.user!.userId }
      : { publishedContent: config.draftContent, publishedAt: new Date(), scheduledContent: null, scheduledAt: null, updatedBy: req.user!.userId })
    .where(eq(homepageConfigsTable.id, config.id))
    .returning();
  await recordAudit(req, isScheduled ? "scheduled_homepage_publish" : "published_homepage", "homepage", String(updated.id), scheduledAt?.toISOString());
  res.json({ id: updated.id, draftContent: updated.draftContent, publishedContent: updated.publishedContent, scheduledContent: updated.scheduledContent, scheduledAt: updated.scheduledAt, publishedAt: updated.publishedAt, updatedAt: updated.updatedAt });
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
  await recordAudit(req, `vendor_${parsed.data.status}`, "vendor", String(vendor.id), parsed.data.adminNote ?? undefined);
  res.json(formatVendor(vendor, user));
});

// PATCH /admin/vendors/:id
router.patch("/admin/vendors/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const body = req.body as { commissionRateOverride?: unknown; adminNote?: unknown };
  const validCommission = body.commissionRateOverride === undefined || body.commissionRateOverride === null || (typeof body.commissionRateOverride === "number" && body.commissionRateOverride >= 0 && body.commissionRateOverride <= 100);
  const validNote = body.adminNote === undefined || body.adminNote === null || (typeof body.adminNote === "string" && body.adminNote.length <= 500);
  if (!Number.isInteger(id) || !validCommission || !validNote) {
    res.status(400).json({ error: "Invalid vendor update." });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (body.commissionRateOverride !== undefined) updates.commissionRateOverride = body.commissionRateOverride === null ? null : String(body.commissionRateOverride);
  if (body.adminNote !== undefined) updates.adminNote = body.adminNote;
  const [vendor] = await db.update(vendorsTable).set(updates).where(eq(vendorsTable.id, id)).returning();
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, vendor.userId));
  await recordAudit(req, "updated_vendor_terms", "vendor", String(vendor.id));
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
  await recordAudit(req, "marked_vendor_payout", "vendor", String(paramsParsed.data.id), `Payout ${amount}`);

  res.json({
    id: record.id, vendorId: record.vendorId,
    amount: parseFloat(record.amount), note: record.note, createdAt: record.createdAt,
  });
});

// GET /admin/operations
router.get("/admin/operations", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const [lowStock, pendingVendors, customers, auditLogs, categories] = await Promise.all([
    db.select().from(productsTable).where(sql`${productsTable.stock} <= 5`).orderBy(asc(productsTable.stock)).limit(8),
    db.select().from(vendorsTable).where(eq(vendorsTable.status, "pending")).orderBy(desc(vendorsTable.createdAt)).limit(8),
    db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(8),
    db.select().from(adminAuditLogsTable).orderBy(desc(adminAuditLogsTable.createdAt)).limit(12),
    db.select().from(categoriesTable).orderBy(asc(categoriesTable.name)),
  ]);
  res.json({
    lowStock: lowStock.map(p => ({ id: p.id, name: p.name, stock: p.stock, isActive: p.isActive, vendorId: p.vendorId })),
    pendingVendors: pendingVendors.map(v => ({ id: v.id, brandName: v.brandName, status: v.status, createdAt: v.createdAt })),
    recentCustomers: customers.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, isSuspended: u.isSuspended, createdAt: u.createdAt })),
    auditLogs,
    categories,
  });
});

// GET /admin/customers
router.get("/admin/customers", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 80) : "";
  const customers = search
    ? await db.select().from(usersTable).where(sql`${usersTable.email} ILIKE ${`%${search}%`} OR ${usersTable.name} ILIKE ${`%${search}%`}`).orderBy(desc(usersTable.createdAt)).limit(100)
    : await db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(100);
  res.json(customers.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, isSuspended: u.isSuspended, createdAt: u.createdAt })));
});

// PATCH /admin/customers/:id
router.patch("/admin/customers/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const body = req.body as { isSuspended?: unknown; name?: unknown };
  const validSuspension = body.isSuspended === undefined || typeof body.isSuspended === "boolean";
  const validName = body.name === undefined || (typeof body.name === "string" && body.name.trim().length > 0 && body.name.length <= 120);
  if (!Number.isInteger(id) || !validSuspension || !validName) {
    res.status(400).json({ error: "Invalid customer update." });
    return;
  }
  if (id === req.user!.userId && body.isSuspended) {
    res.status(400).json({ error: "You cannot suspend the active administrator." });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (body.isSuspended !== undefined) updates.isSuspended = body.isSuspended;
  if (typeof body.name === "string") updates.name = body.name.trim();
  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Customer not found." });
    return;
  }
  await recordAudit(req, updated.isSuspended ? "suspended_customer" : "updated_customer", "customer", String(updated.id));
  res.json({ id: updated.id, email: updated.email, name: updated.name, role: updated.role, isSuspended: updated.isSuspended, createdAt: updated.createdAt });
});

// GET /admin/exports/:resource
router.get("/admin/exports/:resource", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const resource = Array.isArray(req.params.resource) ? req.params.resource[0] : req.params.resource;
  const rows = resource === "products"
    ? (await db.select().from(productsTable).orderBy(desc(productsTable.createdAt))).map(p => ["Product", p.id, p.name, p.category ?? "", p.price, p.stock, p.isActive ? "active" : "hidden"])
    : resource === "orders"
      ? (await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt))).map(o => ["Order", o.id, o.status, o.totalAmount, o.currency, o.shippingCity, o.createdAt.toISOString()])
      : resource === "customers"
        ? (await db.select().from(usersTable).orderBy(desc(usersTable.createdAt))).map(u => ["Customer", u.id, u.name ?? "", u.email, u.role, u.isSuspended ? "suspended" : "active"])
        : resource === "transactions"
          ? (await db.select().from(transactionsTable).orderBy(desc(transactionsTable.createdAt))).map(t => ["Transaction", t.id, t.orderId, t.amount, t.status, t.processor, t.createdAt.toISOString()])
          : null;
  if (!rows) {
    res.status(400).json({ error: "Export resource must be products, orders, customers, or transactions." });
    return;
  }
  await recordAudit(req, "exported_data", "export", resource);
  const csv = rows.map(row => row.map(formatCsvCell).join(",")).join("\n");
  res.type("text/csv").attachment(`rare-district-${resource}.csv`).send(csv);
});

export default router;
