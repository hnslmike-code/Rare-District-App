import { Router, type IRouter } from "express";
import { and, eq, desc, sql, asc, gt, inArray, or } from "drizzle-orm";
import { db, usersTable, vendorsTable, productsTable, ordersTable, orderItemsTable, transactionsTable, adminSettingsTable, payoutRecordsTable, homepageConfigsTable, vendorJoinPageConfigsTable, adminAuditLogsTable, categoriesTable, type HomepageContent, type VendorJoinPageContent } from "@workspace/db";
import {
  UpdateVendorStatusParams, UpdateVendorStatusBody,
  ListAdminVendorsQueryParams, ListAdminProductsQueryParams, ListAdminOrdersQueryParams,
  ListTransactionsQueryParams, MarkVendorPayoutParams, MarkVendorPayoutBody, GetAdminVendorDetailParams,
  UpdateAdminSettingsBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { defaultVendorJoinPageContent, normalizeVendorJoinPageContent } from "../lib/vendor-join-content";
import { createVendorAlert } from "../lib/vendor-notifications";

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

function isHexColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function isOptionList(value: unknown, max: number) {
  return Array.isArray(value) && value.length > 0 && value.length <= max &&
    value.every(option => option && typeof option === "object" && isShortText((option as { value?: unknown }).value, 80) && isShortText((option as { label?: unknown }).label, 100));
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isVendorJoinPageContent(value: unknown): value is VendorJoinPageContent {
  if (!isObjectRecord(value) || !isObjectRecord(value.hero) || !isObjectRecord(value.brief) || !isObjectRecord(value.form) || !isObjectRecord(value.status) || !isObjectRecord(value.theme)) return false;
  const content = value as unknown as VendorJoinPageContent;
  const textFields = [
    content.hero?.callLabel, content.hero?.eyebrow, content.hero?.intakeLabel, content.hero?.titleLine1, content.hero?.titleLine2, content.hero?.description,
    content.brief?.kicker, content.brief?.headline, content.brief?.lookingForLabel, content.brief?.note,
    content.form?.eyebrow, content.form?.title, content.form?.progressLabel, content.form?.contactLegend, content.form?.contactAccent,
    content.form?.fullNameLabel, content.form?.fullNamePlaceholder, content.form?.emailLabel, content.form?.emailFallback,
    content.form?.phoneLabel, content.form?.phonePlaceholder, content.form?.brandLegend, content.form?.brandAccent,
    content.form?.brandNameLabel, content.form?.brandNamePlaceholder, content.form?.categoryLabel, content.form?.categoryPlaceholder,
    content.form?.experienceLabel, content.form?.experiencePlaceholder, content.form?.bioLabel, content.form?.bioPlaceholder,
    content.form?.bioHint, content.form?.proofLegend, content.form?.proofAccent, content.form?.socialLabel,
    content.form?.socialPlaceholder, content.form?.socialHint, content.form?.samplesLabel, content.form?.uploadTitle,
    content.form?.uploadHint, content.form?.uploadingLabel, content.form?.uploadedSuffix, content.form?.submitLabel, content.form?.submittingLabel, content.form?.legal,
    content.status?.pendingLabel, content.status?.pendingTitle, content.status?.pendingDescription,
    content.status?.rejectedLabel, content.status?.rejectedTitle, content.status?.rejectedDescription,
    content.status?.backLabel, content.status?.backHref,
  ];
  return Boolean(
    textFields.every(field => isShortText(field, 500)) &&
    Array.isArray(content.hero.tags) && content.hero.tags.length > 0 && content.hero.tags.length <= 6 && content.hero.tags.every(tag => isShortText(tag, 100)) &&
    Array.isArray(content.brief.lookingFor) && content.brief.lookingFor.length > 0 && content.brief.lookingFor.length <= 6 && content.brief.lookingFor.every(item => isShortText(item, 160)) &&
    typeof content.status.backHref === "string" && content.status.backHref.startsWith("/") &&
    Number.isInteger(content.form.rules?.bioMinLength) && content.form.rules.bioMinLength >= 20 && content.form.rules.bioMinLength <= 1000 &&
    Number.isInteger(content.form.rules?.minSamples) && Number.isInteger(content.form.rules?.maxSamples) &&
    content.form.rules.minSamples >= 1 && content.form.rules.maxSamples >= content.form.rules.minSamples && content.form.rules.maxSamples <= 10 &&
    Number.isInteger(content.form.rules?.maxImageBytes) && content.form.rules.maxImageBytes >= 100_000 && content.form.rules.maxImageBytes <= 10_000_000 &&
    isOptionList(content.categoryOptions, 12) && isOptionList(content.experienceOptions, 12) &&
    isHexColor(content.theme.acid) && isHexColor(content.theme.pink) && isHexColor(content.theme.cyan) &&
    isHexColor(content.theme.ink) && isHexColor(content.theme.backgroundStart) && isHexColor(content.theme.backgroundEnd) &&
    typeof content.theme.gridOpacity === "string" && /^(0(\.[0-9]+)?|1(\.0+)?)$/.test(content.theme.gridOpacity),
  );
}

function formatVendorJoinConfig(config: typeof vendorJoinPageConfigsTable.$inferSelect) {
  return {
    id: config.id,
    draftContent: normalizeVendorJoinPageContent(config.draftContent),
    publishedContent: config.publishedContent ? normalizeVendorJoinPageContent(config.publishedContent) : null,
    scheduledContent: config.scheduledContent ? normalizeVendorJoinPageContent(config.scheduledContent) : null,
    scheduledAt: config.scheduledAt,
    publishedAt: config.publishedAt,
    updatedAt: config.updatedAt,
  };
}

async function getVendorJoinConfig() {
  const [existing] = await db.select().from(vendorJoinPageConfigsTable).orderBy(asc(vendorJoinPageConfigsTable.id)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(vendorJoinPageConfigsTable).values({ draftContent: defaultVendorJoinPageContent }).returning();
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
    id: v.id, userId: v.userId, brandName: v.brandName, contactName: v.contactName, phone: v.phone, description: v.description,
    category: v.category, experienceLevel: v.experienceLevel, socialLink: v.socialLink, sampleImages: v.sampleImages,
    logoUrl: v.logoUrl, website: v.website, status: v.status,
    commissionRateOverride: v.commissionRateOverride ? parseFloat(v.commissionRateOverride) : null,
    payoutBalance: parseFloat(v.payoutBalance ?? "0"), adminNote: v.adminNote, createdAt: v.createdAt,
    user: user ? { id: user.id, email: user.email, name: user.name, isSuspended: user.isSuspended, createdAt: user.createdAt } : undefined,
  };
}

function maskLastFour(value: string | null) {
  const lastFour = value?.replace(/\s/g, "").slice(-4);
  return lastFour || null;
}

function maskReference(value: string | null) {
  if (!value) return null;
  return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
}

function toAdminUser(user: { id: number | null; name: string | null; email: string | null }) {
  return user.id && user.email ? { id: user.id, name: user.name, email: user.email } : undefined;
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

// GET /admin/vendor-join
router.get("/admin/vendor-join", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  res.json(formatVendorJoinConfig(await getVendorJoinConfig()));
});

// PATCH /admin/vendor-join
router.patch("/admin/vendor-join", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  if (!isVendorJoinPageContent(req.body)) {
    res.status(400).json({ error: "Vendor join page content is incomplete or invalid." });
    return;
  }
  const config = await getVendorJoinConfig();
  const [updated] = await db.update(vendorJoinPageConfigsTable)
    .set({ draftContent: req.body, updatedBy: req.user!.userId })
    .where(eq(vendorJoinPageConfigsTable.id, config.id))
    .returning();
  await recordAudit(req, "saved_vendor_join_draft", "vendor_join_page", String(updated.id));
  res.json(formatVendorJoinConfig(updated));
});

// POST /admin/vendor-join/publish
router.post("/admin/vendor-join/publish", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const payload = req.body as { mode?: unknown; scheduledAt?: unknown };
  if ((payload.mode !== "now" && payload.mode !== "schedule") || (payload.mode === "schedule" && typeof payload.scheduledAt !== "string")) {
    res.status(400).json({ error: "Choose publish now or provide a future schedule time." });
    return;
  }
  const config = await getVendorJoinConfig();
  const content = normalizeVendorJoinPageContent(config.draftContent);
  const isScheduled = payload.mode === "schedule";
  const scheduledAt = isScheduled ? new Date(payload.scheduledAt as string) : null;
  if (scheduledAt && (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date())) {
    res.status(400).json({ error: "Scheduled publish time must be in the future." });
    return;
  }
  const [updated] = await db.update(vendorJoinPageConfigsTable)
    .set(isScheduled
      ? { scheduledContent: content, scheduledAt, updatedBy: req.user!.userId }
      : { publishedContent: content, publishedAt: new Date(), scheduledContent: null, scheduledAt: null, updatedBy: req.user!.userId })
    .where(eq(vendorJoinPageConfigsTable.id, config.id))
    .returning();
  await recordAudit(req, isScheduled ? "scheduled_vendor_join_publish" : "published_vendor_join", "vendor_join_page", String(updated.id), scheduledAt?.toISOString());
  res.json(formatVendorJoinConfig(updated));
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

// GET /admin/vendors/:id
// This is deliberately vendor-scoped: order rows are joined through order_items,
// so a multi-vendor order can never reveal another vendor's fulfillment data.
router.get("/admin/vendors/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramsParsed = GetAdminVendorDetailParams.safeParse({ id: raw });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid vendor id." });
    return;
  }
  const vendorId = paramsParsed.data.id;
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId));
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found." });
    return;
  }

  const [
    [vendorUser],
    catalog,
    itemRows,
    transactions,
    payouts,
  ] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, vendor.userId)).limit(1),
    db.select().from(productsTable).where(eq(productsTable.vendorId, vendorId)).orderBy(desc(productsTable.createdAt)).limit(100),
    db.select({
      id: orderItemsTable.id,
      orderId: orderItemsTable.orderId,
      productId: orderItemsTable.productId,
      productName: productsTable.name,
      quantity: orderItemsTable.quantity,
      selectedSize: orderItemsTable.selectedSize,
      unitPrice: orderItemsTable.unitPrice,
      commissionAmount: orderItemsTable.commissionAmount,
      vendorAmount: orderItemsTable.vendorAmount,
      fulfillmentStatus: orderItemsTable.fulfillmentStatus,
      orderStatus: ordersTable.status,
      orderedAt: ordersTable.createdAt,
      customerId: usersTable.id,
      customerName: usersTable.name,
      customerEmail: usersTable.email,
    }).from(orderItemsTable)
      .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
      .leftJoin(productsTable, eq(productsTable.id, orderItemsTable.productId))
      .leftJoin(usersTable, eq(usersTable.id, ordersTable.userId))
      .where(eq(orderItemsTable.vendorId, vendorId))
      .orderBy(desc(ordersTable.createdAt))
      .limit(100),
    db.select().from(transactionsTable).where(eq(transactionsTable.vendorId, vendorId)).orderBy(desc(transactionsTable.createdAt)).limit(500),
    db.select().from(payoutRecordsTable).where(eq(payoutRecordsTable.vendorId, vendorId)).orderBy(desc(payoutRecordsTable.createdAt)).limit(100),
  ]);

  const payoutIds = payouts.map(payout => String(payout.id));
  const auditScope = payoutIds.length
    ? or(
      and(eq(adminAuditLogsTable.entityType, "vendor"), eq(adminAuditLogsTable.entityId, String(vendorId))),
      and(eq(adminAuditLogsTable.entityType, "payout"), inArray(adminAuditLogsTable.entityId, payoutIds)),
    )
    : and(eq(adminAuditLogsTable.entityType, "vendor"), eq(adminAuditLogsTable.entityId, String(vendorId)));
  const auditRows = await db.select({
    id: adminAuditLogsTable.id,
    action: adminAuditLogsTable.action,
    entityType: adminAuditLogsTable.entityType,
    entityId: adminAuditLogsTable.entityId,
    detail: adminAuditLogsTable.detail,
    createdAt: adminAuditLogsTable.createdAt,
    adminId: usersTable.id,
    adminName: usersTable.name,
    adminEmail: usersTable.email,
  }).from(adminAuditLogsTable)
    .leftJoin(usersTable, eq(usersTable.id, adminAuditLogsTable.adminUserId))
    .where(auditScope)
    .orderBy(desc(adminAuditLogsTable.createdAt))
    .limit(100);

  const successfulTransactions = transactions.filter(transaction => transaction.status === "success");
  const pendingPayouts = payouts
    .filter(payout => payout.status === "pending" || payout.status === "approved")
    .reduce((total, payout) => total + Number(payout.amount), 0);
  const paidPayouts = payouts
    .filter(payout => payout.status === "paid")
    .reduce((total, payout) => total + Number(payout.amount), 0);
  const auditEvents = auditRows.map(row => ({
    id: row.id, action: row.action, entityType: row.entityType, entityId: row.entityId,
    detail: row.detail, createdAt: row.createdAt,
    admin: toAdminUser({ id: row.adminId, name: row.adminName, email: row.adminEmail }),
  }));
  const decisionEvents = auditEvents.filter(event => event.action === "vendor_approved" || event.action === "vendor_rejected");

  res.json({
    vendor: {
      id: vendor.id, userId: vendor.userId, brandName: vendor.brandName, contactName: vendor.contactName, phone: vendor.phone,
      description: vendor.description, category: vendor.category, experienceLevel: vendor.experienceLevel, socialLink: vendor.socialLink,
      sampleImages: vendor.sampleImages, logoUrl: vendor.logoUrl, website: vendor.website, status: vendor.status,
      commissionRateOverride: vendor.commissionRateOverride ? Number(vendor.commissionRateOverride) : null,
      payoutBalance: Number(vendor.payoutBalance), adminNote: vendor.adminNote, createdAt: vendor.createdAt,
      user: vendorUser ? { id: vendorUser.id, email: vendorUser.email, name: vendorUser.name, isSuspended: vendorUser.isSuspended, createdAt: vendorUser.createdAt } : undefined,
      payoutAccount: {
        bankName: vendor.bankName,
        accountName: vendor.accountName,
        accountNumberLast4: maskLastFour(vendor.accountNumber),
      },
    },
    catalog: catalog.map(product => ({
      id: product.id, vendorId: product.vendorId, name: product.name, description: product.description,
      price: Number(product.price), currency: product.currency, category: product.category, sizes: product.sizes,
      images: product.images, stock: product.stock, isActive: product.isActive, isFeatured: product.isFeatured,
      wardrobeCount: product.wardrobeCount, averageRating: null, reviewCount: 0, createdAt: product.createdAt,
    })),
    orderItems: itemRows.map(item => ({
      id: item.id, orderId: item.orderId, productId: item.productId, productName: item.productName ?? "Removed product",
      quantity: item.quantity, selectedSize: item.selectedSize, unitPrice: Number(item.unitPrice),
      commissionAmount: Number(item.commissionAmount), vendorAmount: Number(item.vendorAmount),
      fulfillmentStatus: item.fulfillmentStatus, orderStatus: item.orderStatus, orderedAt: item.orderedAt,
      customer: item.customerId && item.customerEmail
        ? { id: item.customerId, name: item.customerName, email: item.customerEmail }
        : undefined,
    })),
    balance: {
      available: Number(vendor.payoutBalance),
      pendingPayouts,
      totalPaid: paidPayouts,
      totalSales: successfulTransactions.reduce((total, transaction) => total + Number(transaction.vendorAmount), 0),
      totalCommission: successfulTransactions.reduce((total, transaction) => total + Number(transaction.commissionAmount), 0),
    },
    payouts: payouts.map(payout => ({
      id: payout.id, amount: Number(payout.amount), note: payout.note, status: payout.status,
      reference: maskReference(payout.reference), reviewedAt: payout.reviewedAt, paidAt: payout.paidAt, createdAt: payout.createdAt,
    })),
    notes: [
      ...(vendor.adminNote ? [{ id: 0, text: vendor.adminNote, createdAt: vendor.updatedAt, admin: undefined }] : []),
      ...auditEvents.filter(event => event.action === "saved_vendor_note" && event.detail).map(event => ({
        id: event.id, text: event.detail!, createdAt: event.createdAt, admin: event.admin,
      })),
    ],
    suspensions: auditEvents.filter(event => event.action === "vendor_rejected").map(event => ({
      id: event.id, reason: event.detail ?? "No reason recorded.", createdAt: event.createdAt, admin: event.admin,
    })),
    decisions: decisionEvents.map(event => ({
      id: event.id, status: event.action === "vendor_approved" ? "approved" : "rejected",
      note: event.detail, createdAt: event.createdAt, admin: event.admin,
    })),
    auditEvents,
  });
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
  const updates: { status: "approved" | "rejected"; adminNote?: string } = { status: parsed.data.status };
  if (parsed.data.adminNote !== undefined) updates.adminNote = parsed.data.adminNote;
  const [vendor] = await db.update(vendorsTable)
    .set(updates)
    .where(eq(vendorsTable.id, paramsParsed.data.id)).returning();
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found." });
    return;
  }

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
  await recordAudit(req, body.adminNote === undefined ? "updated_vendor_terms" : "saved_vendor_note", "vendor", String(vendor.id), typeof body.adminNote === "string" ? body.adminNote : undefined);
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
    orderItemId: t.orderItemId, transactionType: t.transactionType,
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

// PATCH /admin/payouts/:id — review a vendor-requested payout.
router.patch("/admin/payouts/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const payoutId = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const nextStatus = req.body?.status;
  if (!Number.isInteger(payoutId) || !["approved", "paid", "failed", "reversed"].includes(nextStatus)) {
    res.status(400).json({ error: "Invalid payout update." });
    return;
  }
  const [record] = await db.select().from(payoutRecordsTable).where(eq(payoutRecordsTable.id, payoutId));
  if (!record) {
    res.status(404).json({ error: "Payout not found." });
    return;
  }
  const transitions: Record<string, string[]> = {
    pending: ["approved", "failed"],
    approved: ["paid", "failed"],
    paid: ["reversed"],
    failed: [],
    reversed: [],
  };
  if (!transitions[record.status]?.includes(nextStatus)) {
    res.status(409).json({ error: `Cannot move payout from ${record.status} to ${nextStatus}.` });
    return;
  }
  const shouldRestoreBalance = nextStatus === "failed" || nextStatus === "reversed";
  const result = await db.transaction(async (tx) => {
    // Serialize all status changes for this payout. A second request may have
    // read the old status before the first transaction committed, so the
    // transition must be checked again after acquiring the row lock.
    await tx.execute(sql`SELECT id FROM payout_records WHERE id = ${record.id} FOR UPDATE`);
    const [lockedRecord] = await tx.select().from(payoutRecordsTable).where(eq(payoutRecordsTable.id, record.id));
    if (!lockedRecord || !transitions[lockedRecord.status]?.includes(nextStatus)) {
      return { conflict: true as const, status: lockedRecord?.status ?? record.status };
    }

    if (shouldRestoreBalance) {
      await tx.update(vendorsTable)
        .set({ payoutBalance: sql`${vendorsTable.payoutBalance} + ${lockedRecord.amount}` })
        .where(eq(vendorsTable.id, lockedRecord.vendorId));
    }
    const [next] = await tx.update(payoutRecordsTable).set({
      status: nextStatus as "approved" | "paid" | "failed" | "reversed",
      reference: typeof req.body?.reference === "string" ? req.body.reference.slice(0, 120) : lockedRecord.reference,
      reviewedAt: new Date(),
      paidAt: nextStatus === "paid" ? new Date() : lockedRecord.paidAt,
      note: typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : lockedRecord.note,
    }).where(eq(payoutRecordsTable.id, lockedRecord.id)).returning();
    const [vendor] = await tx.select().from(vendorsTable).where(eq(vendorsTable.id, lockedRecord.vendorId));
    if (vendor) await createVendorAlert(tx, vendor, {
      type: "payout",
      title: `Payout ${nextStatus}`,
      body: `Your ₦${Number(lockedRecord.amount).toLocaleString()} payout is now ${nextStatus}.`,
      href: "/vendor-dashboard/payouts",
    });
    return { conflict: false as const, updated: next };
  });
  if (result.conflict) {
    res.status(409).json({ error: `Cannot move payout from ${result.status} to ${nextStatus}.` });
    return;
  }
  const updated = result.updated;
  await recordAudit(req, "updated_vendor_payout", "payout", String(record.id), `Payout moved to ${nextStatus}`);
  res.json({ id: updated.id, vendorId: updated.vendorId, amount: Number(updated.amount), status: updated.status, reference: updated.reference, reviewedAt: updated.reviewedAt, paidAt: updated.paidAt });
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
