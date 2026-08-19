import { Router, type IRouter } from "express";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { db, vendorsTable, usersTable, productsTable, ordersTable, orderItemsTable, transactionsTable, payoutRecordsTable, vendorJoinPageConfigsTable } from "@workspace/db";
import { ApplyAsVendorBody, UpdateMyVendorProfileBody, GetVendorParams, GetVendorRecentOrdersQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { defaultVendorJoinPageContent, normalizeVendorJoinPageContent } from "../lib/vendor-join-content";
import { ObjectStorageService } from "../lib/objectStorage";
import { formatPublicVendor } from "../lib/public-responses";
import { hasApprovedVendorAccess } from "../lib/security-boundaries";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function formatVendor(v: typeof vendorsTable.$inferSelect, user?: typeof usersTable.$inferSelect) {
  return {
    id: v.id,
    userId: v.userId,
    brandName: v.brandName,
    contactName: v.contactName,
    phone: v.phone,
    description: v.description,
    category: v.category,
    experienceLevel: v.experienceLevel,
    socialLink: v.socialLink,
    sampleImages: v.sampleImages,
    logoUrl: v.logoUrl,
    website: v.website,
    bankName: v.bankName,
    accountNumber: v.accountNumber,
    accountName: v.accountName,
    status: v.status,
    commissionRateOverride: v.commissionRateOverride ? parseFloat(v.commissionRateOverride) : null,
    payoutBalance: parseFloat(v.payoutBalance ?? "0"),
    adminNote: v.adminNote,
    createdAt: v.createdAt,
    user: user ? { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, referralCode: user.referralCode, referredBy: user.referredBy, createdAt: user.createdAt } : undefined,
  };
}

async function getApprovedVendor(userId: number) {
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
  return vendor && hasApprovedVendorAccess(vendor.status) ? vendor : undefined;
}

async function getPublishedVendorJoinRules() {
  const [config] = await db.select().from(vendorJoinPageConfigsTable).orderBy(desc(vendorJoinPageConfigsTable.id)).limit(1);
  const scheduledIsLive = Boolean(config?.scheduledContent && config.scheduledAt && config.scheduledAt <= new Date());
  return normalizeVendorJoinPageContent((scheduledIsLive ? config?.scheduledContent : config?.publishedContent) ?? defaultVendorJoinPageContent);
}

// POST /vendors/apply
router.post("/vendors/apply", requireAuth, async (req, res): Promise<void> => {
  const parsed = ApplyAsVendorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const pageContent = await getPublishedVendorJoinRules();
  const { rules } = pageContent.form;
  if (
    parsed.data.description.trim().length < rules.bioMinLength ||
    parsed.data.sampleImages.length < rules.minSamples ||
    parsed.data.sampleImages.length > rules.maxSamples ||
    !pageContent.categoryOptions.some(option => option.value === parsed.data.category) ||
    !pageContent.experienceOptions.some(option => option.value === parsed.data.experienceLevel)
  ) {
    res.status(400).json({ error: "Your application does not meet the current vendor intake requirements." });
    return;
  }
  const uploadedImagesAreValid = await Promise.all(parsed.data.sampleImages.map(async objectPath => {
    try {
      const file = await objectStorageService.getObjectEntityFile(objectPath);
      const [metadata] = await file.getMetadata();
      return typeof metadata.contentType === "string" &&
        metadata.contentType.startsWith("image/") &&
        Number(metadata.size) > 0 &&
        Number(metadata.size) <= rules.maxImageBytes;
    } catch {
      return false;
    }
  }));
  if (uploadedImagesAreValid.some(valid => !valid)) {
    res.status(400).json({ error: "One or more uploaded samples do not meet the current image requirements." });
    return;
  }
  const existing = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, req.user!.userId));
  if (existing.length > 0) {
    res.status(409).json({ error: "Already a vendor" });
    return;
  }
  const [vendor] = await db.insert(vendorsTable).values({ ...parsed.data, userId: req.user!.userId }).returning();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  // Update user role to vendor
  if (parsed.data.contactName) {
    await db.update(usersTable).set({ name: parsed.data.contactName }).where(eq(usersTable.id, req.user!.userId));
  }
  await db.update(usersTable).set({ role: "vendor" }).where(eq(usersTable.id, req.user!.userId));
  res.status(201).json(formatVendor(vendor, user));
});

// GET /vendors/me
router.get("/vendors/me", requireAuth, async (req, res): Promise<void> => {
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, req.user!.userId));
  if (!vendor) {
    res.status(404).json({ error: "Not a vendor" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  res.json(formatVendor(vendor, user));
});

// PATCH /vendors/me
router.patch("/vendors/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateMyVendorProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, req.user!.userId));
  if (!existing) {
    res.status(404).json({ error: "Not a vendor" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.brandName != null) updates.brandName = parsed.data.brandName;
  if (parsed.data.contactName != null) updates.contactName = parsed.data.contactName;
  if (parsed.data.phone != null) updates.phone = parsed.data.phone;
  if (parsed.data.description != null) updates.description = parsed.data.description;
  if (parsed.data.category != null) updates.category = parsed.data.category;
  if (parsed.data.experienceLevel != null) updates.experienceLevel = parsed.data.experienceLevel;
  if (parsed.data.socialLink != null) updates.socialLink = parsed.data.socialLink;
  if (parsed.data.sampleImages != null) updates.sampleImages = parsed.data.sampleImages;
  if (parsed.data.logoUrl != null) updates.logoUrl = parsed.data.logoUrl;
  if (parsed.data.website != null) updates.website = parsed.data.website;
  // Payout details are only mutable after approval; the public/profile surface
  // never returns them and the dashboard editor does not render them.
  if (existing.status === "approved") {
    if (parsed.data.bankName != null) updates.bankName = parsed.data.bankName;
    if (parsed.data.accountNumber != null) updates.accountNumber = parsed.data.accountNumber;
    if (parsed.data.accountName != null) updates.accountName = parsed.data.accountName;
  }

  const [vendor] = await db.update(vendorsTable).set(updates).where(eq(vendorsTable.id, existing.id)).returning();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  res.json(formatVendor(vendor, user));
});

// Operational settings are kept separate from the public vendor profile.
router.get("/vendors/me/operations-settings", requireAuth, async (req, res): Promise<void> => {
  const vendor = await getApprovedVendor(req.user!.userId);
  if (!vendor) {
    res.status(403).json({ error: "Vendor approval is required." });
    return;
  }
  res.json({
    shippingRegions: vendor.shippingRegions,
    processingDays: vendor.processingDays,
    returnWindowDays: vendor.returnWindowDays,
    returnConditions: vendor.returnConditions,
    cancellationPolicy: vendor.cancellationPolicy,
    notificationPreferences: vendor.notificationPreferences,
  });
});

router.patch("/vendors/me/operations-settings", requireAuth, async (req, res): Promise<void> => {
  const vendor = await getApprovedVendor(req.user!.userId);
  if (!vendor) {
    res.status(403).json({ error: "Vendor approval is required." });
    return;
  }
  const body = req.body ?? {};
  const shippingRegions = Array.isArray(body.shippingRegions)
    ? body.shippingRegions.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0).slice(0, 30).map((value: string) => value.trim())
    : vendor.shippingRegions;
  const processingDays = Number(body.processingDays);
  const returnWindowDays = Number(body.returnWindowDays);
  if (!Number.isInteger(processingDays) || processingDays < 1 || processingDays > 90 ||
      !Number.isInteger(returnWindowDays) || returnWindowDays < 0 || returnWindowDays > 90) {
    res.status(400).json({ error: "Processing and return windows must be valid day counts." });
    return;
  }
  const notificationPreferences = body.notificationPreferences && typeof body.notificationPreferences === "object"
    ? Object.fromEntries(Object.entries(body.notificationPreferences).filter(([, value]) => typeof value === "boolean")) as Record<string, boolean>
    : vendor.notificationPreferences;
  const [updated] = await db.update(vendorsTable).set({
    shippingRegions,
    processingDays,
    returnWindowDays,
    returnConditions: typeof body.returnConditions === "string" ? body.returnConditions.slice(0, 2000) : vendor.returnConditions,
    cancellationPolicy: typeof body.cancellationPolicy === "string" ? body.cancellationPolicy.slice(0, 2000) : vendor.cancellationPolicy,
    notificationPreferences,
  }).where(eq(vendorsTable.id, vendor.id)).returning();
  res.json({
    shippingRegions: updated.shippingRegions, processingDays: updated.processingDays,
    returnWindowDays: updated.returnWindowDays, returnConditions: updated.returnConditions,
    cancellationPolicy: updated.cancellationPolicy, notificationPreferences: updated.notificationPreferences,
  });
});

// GET /vendors/dashboard
router.get("/vendors/dashboard", requireAuth, async (req, res): Promise<void> => {
  const vendor = await getApprovedVendor(req.user!.userId);
  if (!vendor) {
    res.status(403).json({ error: "Vendor approval is required for dashboard access." });
    return;
  }

  const transactions = await db.select().from(transactionsTable).where(and(
    eq(transactionsTable.vendorId, vendor.id),
    eq(transactionsTable.status, "success"),
  ));
  const totalRevenue = transactions.reduce((sum, transaction) => sum + parseFloat(transaction.vendorAmount), 0);
  const orders = await db.select().from(ordersTable)
    .where(sql`id IN (SELECT DISTINCT order_id FROM order_items WHERE vendor_id = ${vendor.id})`);
  const pendingOrders = orders.filter(o => o.status === "paid" || o.status === "processing").length;
  const products = await db.select().from(productsTable).where(and(eq(productsTable.vendorId, vendor.id), eq(productsTable.isActive, true)));

  const salesRows = await db.select({
    productId: orderItemsTable.productId,
    unitsSold: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)`,
    revenue: sql<number>`coalesce(sum(${orderItemsTable.vendorAmount}), 0)`,
  }).from(orderItemsTable)
    .innerJoin(transactionsTable, and(
      eq(transactionsTable.orderId, orderItemsTable.orderId),
      eq(transactionsTable.vendorId, vendor.id),
      eq(transactionsTable.status, "success"),
    ))
    .where(eq(orderItemsTable.vendorId, vendor.id))
    .groupBy(orderItemsTable.productId)
    .orderBy(desc(sql`coalesce(sum(${orderItemsTable.quantity}), 0)`))
    .limit(5);
  const topProductRows = salesRows.length > 0
    ? await db.select().from(productsTable).where(and(eq(productsTable.vendorId, vendor.id), inArray(productsTable.id, salesRows.map(row => row.productId))))
    : [];
  const salesByProduct = new Map(salesRows.map(row => [row.productId, row]));

  const monthlyRows = await db.select({
    month: sql<string>`to_char(date_trunc('month', ${transactionsTable.createdAt}), 'Mon YYYY')`,
    revenue: sql<number>`coalesce(sum(${transactionsTable.vendorAmount}), 0)`,
  }).from(transactionsTable).where(and(
    eq(transactionsTable.vendorId, vendor.id),
    eq(transactionsTable.status, "success"),
    sql`${transactionsTable.createdAt} >= now() - interval '6 months'`,
  )).groupBy(sql`date_trunc('month', ${transactionsTable.createdAt})`).orderBy(sql`date_trunc('month', ${transactionsTable.createdAt})`);

  res.json({
    totalRevenue,
    totalOrders: orders.length,
    pendingOrders,
    totalProducts: products.length,
    payoutBalance: parseFloat(vendor.payoutBalance ?? "0"),
    monthlySales: monthlyRows.map(row => ({ month: row.month, revenue: Number(row.revenue) })),
     topProducts: topProductRows.sort((a, b) => (Number(salesByProduct.get(b.id)?.unitsSold ?? 0) - Number(salesByProduct.get(a.id)?.unitsSold ?? 0))).map(p => ({
      id: p.id, vendorId: p.vendorId, name: p.name, description: p.description,
      price: parseFloat(p.price), currency: p.currency, category: p.category,
      sizes: p.sizes, images: p.images, stock: p.stock, isActive: p.isActive,
       isFeatured: p.isFeatured, wardrobeCount: p.wardrobeCount,
       unitsSold: Number(salesByProduct.get(p.id)?.unitsSold ?? 0),
       vendorRevenue: Number(salesByProduct.get(p.id)?.revenue ?? 0),
      averageRating: null, reviewCount: 0, createdAt: p.createdAt,
    })),
  });
});

// GET /vendors/dashboard/recent-orders
router.get("/vendors/dashboard/recent-orders", requireAuth, async (req, res): Promise<void> => {
  const vendor = await getApprovedVendor(req.user!.userId);
  if (!vendor) {
    res.status(403).json({ error: "Vendor approval is required for order access." });
    return;
  }
  const parsed = GetVendorRecentOrdersQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 10) : 10;

  const recentOrders = await db.select().from(ordersTable)
    .where(sql`id IN (SELECT DISTINCT order_id FROM order_items WHERE vendor_id = ${vendor.id})`)
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit);

  const result = await Promise.all(recentOrders.map(async (o) => {
    const items = await db.select({
      id: orderItemsTable.id,
      orderId: orderItemsTable.orderId,
      productId: orderItemsTable.productId,
      vendorId: orderItemsTable.vendorId,
      quantity: orderItemsTable.quantity,
      selectedSize: orderItemsTable.selectedSize,
      unitPrice: orderItemsTable.unitPrice,
      commissionRate: orderItemsTable.commissionRate,
      commissionAmount: orderItemsTable.commissionAmount,
      vendorAmount: orderItemsTable.vendorAmount,
      fulfillmentStatus: orderItemsTable.fulfillmentStatus,
      trackingNumber: orderItemsTable.trackingNumber,
      carrier: orderItemsTable.carrier,
      shippedAt: orderItemsTable.shippedAt,
      productName: productsTable.name,
      productImages: productsTable.images,
    }).from(orderItemsTable)
      .leftJoin(productsTable, eq(productsTable.id, orderItemsTable.productId))
      .where(and(eq(orderItemsTable.orderId, o.id), eq(orderItemsTable.vendorId, vendor.id)));
    return {
      id: o.id, userId: o.userId, status: o.status,
      totalAmount: parseFloat(o.totalAmount), discountAmount: parseFloat(o.discountAmount ?? "0"),
      currency: o.currency, shippingAddress: o.shippingAddress,
      shippingCity: o.shippingCity, shippingState: o.shippingState,
      shippingPhone: o.shippingPhone, createdAt: o.createdAt,
      items: items.map(item => ({
        id: item.id, orderId: item.orderId, productId: item.productId, vendorId: item.vendorId,
        quantity: item.quantity, selectedSize: item.selectedSize,
        unitPrice: parseFloat(item.unitPrice), commissionRate: parseFloat(item.commissionRate),
        commissionAmount: parseFloat(item.commissionAmount), vendorAmount: parseFloat(item.vendorAmount),
        fulfillmentStatus: item.fulfillmentStatus, trackingNumber: item.trackingNumber,
        carrier: item.carrier, shippedAt: item.shippedAt,
        product: item.productName ? { id: item.productId, name: item.productName, images: item.productImages ?? [] } : undefined,
      })),
    };
  }));
  res.json(result);
});

// PATCH /vendors/orders/:orderId/items/:itemId/fulfillment
router.patch("/vendors/orders/:orderId/items/:itemId/fulfillment", requireAuth, async (req, res): Promise<void> => {
  const vendor = await getApprovedVendor(req.user!.userId);
  const orderId = Number(req.params.orderId);
  const itemId = Number(req.params.itemId);
  const status = req.body?.status;
  const allowed = ["pending", "processing", "ready_to_ship", "shipped", "delivered", "cancelled", "returned", "refunded"];
  if (!vendor || !Number.isInteger(orderId) || !Number.isInteger(itemId)) {
    res.status(403).json({ error: "Approved vendor access is required." });
    return;
  }
  if (!allowed.includes(status)) {
    res.status(400).json({ error: "Invalid fulfillment status." });
    return;
  }
  const [item] = await db.select().from(orderItemsTable).where(and(
    eq(orderItemsTable.id, itemId), eq(orderItemsTable.orderId, orderId), eq(orderItemsTable.vendorId, vendor.id),
  ));
  if (!item) {
    res.status(404).json({ error: "Fulfillment item not found." });
    return;
  }
  const transitions: Record<string, string[]> = {
    pending: ["processing", "cancelled"],
    processing: ["ready_to_ship", "cancelled"],
    ready_to_ship: ["shipped"],
    shipped: ["delivered", "returned"],
    delivered: ["returned", "refunded"],
    cancelled: [],
    returned: ["refunded"],
    refunded: [],
  };
  if (!transitions[item.fulfillmentStatus]?.includes(status)) {
    res.status(409).json({ error: `Cannot move this item from ${item.fulfillmentStatus} to ${status}.` });
    return;
  }
  const trackingNumber = typeof req.body?.trackingNumber === "string" ? req.body.trackingNumber.trim().slice(0, 120) : undefined;
  const carrier = typeof req.body?.carrier === "string" ? req.body.carrier.trim().slice(0, 80) : undefined;
  if (status === "shipped" && !trackingNumber) {
    res.status(400).json({ error: "Tracking number is required before shipping." });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    if (status === "cancelled") {
      await tx.update(productsTable)
        .set({ stock: sql`${productsTable.stock} + ${item.quantity}` })
        .where(eq(productsTable.id, item.productId));
    }
    const [next] = await tx.update(orderItemsTable).set({
      fulfillmentStatus: status as typeof item.fulfillmentStatus,
      trackingNumber: trackingNumber ?? item.trackingNumber,
      carrier: carrier ?? item.carrier,
      shippedAt: status === "shipped" ? new Date() : item.shippedAt,
    }).where(eq(orderItemsTable.id, item.id)).returning();
    return next;
  });
  res.json({
    id: updated.id, orderId: updated.orderId, productId: updated.productId,
    fulfillmentStatus: updated.fulfillmentStatus, trackingNumber: updated.trackingNumber,
    carrier: updated.carrier, shippedAt: updated.shippedAt,
  });
});

// POST /vendors/me/payout-request
router.post("/vendors/me/payout-request", requireAuth, async (req, res): Promise<void> => {
  const vendor = await getApprovedVendor(req.user!.userId);
  if (!vendor) {
    res.status(403).json({ error: "Vendor approval is required to request payouts." });
    return;
  }
  const amount = typeof req.body?.amount === "number" ? req.body.amount : Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount < 1000) {
    res.status(400).json({ error: "Payout requests must be at least ₦1,000." });
    return;
  }
  const [debited] = await db.update(vendorsTable)
    .set({ payoutBalance: sql`${vendorsTable.payoutBalance} - ${amount}` })
    .where(and(eq(vendorsTable.id, vendor.id), sql`${vendorsTable.payoutBalance} >= ${amount}`))
    .returning({ id: vendorsTable.id });
  if (!debited) {
    res.status(409).json({ error: "Requested amount is greater than your available balance." });
    return;
  }
  const [record] = await db.insert(payoutRecordsTable).values({
    vendorId: vendor.id,
    amount: String(amount),
    status: "pending",
    note: typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : null,
  }).returning();
  res.status(201).json({
    id: record.id, amount: Number(record.amount), status: record.status,
    reference: record.reference, createdAt: record.createdAt,
  });
});

// GET /vendors/me/payouts
router.get("/vendors/me/payouts", requireAuth, async (req, res): Promise<void> => {
  const vendor = await getApprovedVendor(req.user!.userId);
  if (!vendor) {
    res.status(403).json({ error: "Vendor approval is required to view payouts." });
    return;
  }
  const records = await db.select().from(payoutRecordsTable)
    .where(eq(payoutRecordsTable.vendorId, vendor.id))
    .orderBy(desc(payoutRecordsTable.createdAt))
    .limit(100);
  res.json(records.map(record => ({
    id: record.id, amount: Number(record.amount), status: record.status,
    reference: record.reference, createdAt: record.createdAt,
    reviewedAt: record.reviewedAt, paidAt: record.paidAt,
  })));
});

// GET /vendors/:id
router.get("/vendors/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = GetVendorParams.safeParse({ id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid vendor id" });
    return;
  }
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, parsed.data.id));
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, vendor.userId));
  res.json(formatPublicVendor(vendor));
});

export default router;
