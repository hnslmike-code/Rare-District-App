import { Router, type IRouter } from "express";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { db, vendorsTable, usersTable, productsTable, ordersTable, orderItemsTable, transactionsTable, vendorJoinPageConfigsTable } from "@workspace/db";
import { ApplyAsVendorBody, UpdateMyVendorProfileBody, GetVendorParams, GetVendorRecentOrdersQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { defaultVendorJoinPageContent, normalizeVendorJoinPageContent } from "../lib/vendor-join-content";
import { ObjectStorageService } from "../lib/objectStorage";

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

function formatPublicVendor(v: typeof vendorsTable.$inferSelect) {
  return {
    id: v.id,
    brandName: v.brandName,
    description: v.description,
    category: v.category,
    logoUrl: v.logoUrl,
    website: v.website,
    socialLink: v.socialLink,
    status: v.status,
    createdAt: v.createdAt,
  };
}

async function getApprovedVendor(userId: number) {
  const [vendor] = await db.select().from(vendorsTable).where(and(
    eq(vendorsTable.userId, userId),
    eq(vendorsTable.status, "approved"),
  ));
  return vendor;
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

  const topProducts = await db.select().from(productsTable)
    .where(eq(productsTable.vendorId, vendor.id))
    .orderBy(desc(productsTable.wardrobeCount))
    .limit(5);

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
    topProducts: topProducts.map(p => ({
      id: p.id, vendorId: p.vendorId, name: p.name, description: p.description,
      price: parseFloat(p.price), currency: p.currency, category: p.category,
      sizes: p.sizes, images: p.images, stock: p.stock, isActive: p.isActive,
      isFeatured: p.isFeatured, wardrobeCount: p.wardrobeCount,
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
        product: item.productName ? { id: item.productId, name: item.productName, images: item.productImages ?? [] } : undefined,
      })),
    };
  }));
  res.json(result);
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
