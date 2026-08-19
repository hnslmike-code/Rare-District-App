import { Router, type IRouter } from "express";
import { eq, desc, asc, gte, lte, ilike, and, sql } from "drizzle-orm";
import { db, productsTable, productVariantsTable, vendorsTable, usersTable, reviewsTable } from "@workspace/db";
import {
  ListProductsQueryParams, CreateProductBody, GetProductParams,
  UpdateProductParams, UpdateProductBody, DeleteProductParams,
  ListFeaturedProductsQueryParams, ListTrendingProductsQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { optionalAuth } from "../middlewares/auth";
import { formatPublicVendor } from "../lib/public-responses";

const router: IRouter = Router();

async function buildProductResponse(p: typeof productsTable.$inferSelect, vendorMap?: Map<number, typeof vendorsTable.$inferSelect>, userMap?: Map<number, typeof usersTable.$inferSelect>) {
  const vendor = vendorMap?.get(p.vendorId);
  const reviewRows = await db.select().from(reviewsTable).where(eq(reviewsTable.productId, p.id));
  const variants = await db.select().from(productVariantsTable).where(and(
    eq(productVariantsTable.productId, p.id),
    eq(productVariantsTable.isActive, true),
  ));
  const avgRating = reviewRows.length > 0 ? reviewRows.reduce((s, r) => s + r.rating, 0) / reviewRows.length : null;
  const user = vendor ? userMap?.get(vendor.userId) : undefined;
  return {
    id: p.id, vendorId: p.vendorId, name: p.name, description: p.description,
    price: parseFloat(p.price), currency: p.currency, category: p.category,
    sizes: p.sizes, images: p.images, stock: p.stock, isActive: p.isActive,
    isFeatured: p.isFeatured, wardrobeCount: p.wardrobeCount,
    averageRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
    reviewCount: reviewRows.length, createdAt: p.createdAt,
    variants: variants.map((variant) => ({
      id: variant.id, productId: variant.productId, sku: variant.sku, attributes: variant.attributes,
      priceAdjustment: Number(variant.priceAdjustment), stock: variant.stock, reservedStock: variant.reservedStock,
      availableStock: variant.stock - variant.reservedStock, isActive: variant.isActive, createdAt: variant.createdAt,
    })),
    vendor: vendor ? formatPublicVendor(vendor) : undefined,
  };
}

// GET /products
router.get("/products", optionalAuth, async (req, res): Promise<void> => {
  const parsed = ListProductsQueryParams.safeParse(req.query);
  const q: {
    category?: string;
    vendorId?: number;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
    size?: string;
    page?: number;
    limit?: number;
    sortBy?: "newest" | "price_asc" | "price_desc" | "popular";
  } = parsed.success ? parsed.data : {};

  let vendorOwnsCatalog = false;
  if (req.user && q.vendorId) {
    const [owner] = await db.select({ id: vendorsTable.id }).from(vendorsTable).where(and(
      eq(vendorsTable.id, q.vendorId),
      eq(vendorsTable.userId, req.user.userId),
      eq(vendorsTable.status, "approved"),
    ));
    vendorOwnsCatalog = Boolean(owner);
  }
  let conditions = vendorOwnsCatalog ? [] : [eq(productsTable.isActive, true)];
  if (q.category) conditions.push(eq(productsTable.category, q.category));
  if (q.vendorId) conditions.push(eq(productsTable.vendorId, q.vendorId));
  if (q.minPrice) conditions.push(gte(productsTable.price, String(q.minPrice)));
  if (q.maxPrice) conditions.push(lte(productsTable.price, String(q.maxPrice)));
  if (q.search) conditions.push(ilike(productsTable.name, `%${q.search}%`));
  if (q.size) conditions.push(sql`${productsTable.sizes} @> ARRAY[${q.size}]::text[]`);

  const page = q.page ?? 1;
  const limit = q.limit ?? 24;
  const offset = (page - 1) * limit;

  const sortMap: Record<string, ReturnType<typeof desc>> = {
    newest: desc(productsTable.createdAt),
    price_asc: asc(productsTable.price),
    price_desc: desc(productsTable.price),
    popular: desc(productsTable.wardrobeCount),
  };
  const orderBy = sortMap[q.sortBy ?? "newest"] ?? desc(productsTable.createdAt);

  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(and(...conditions));
  const total = Number(countRow.count);

  const products = await db.select().from(productsTable).where(and(...conditions)).orderBy(orderBy).limit(limit).offset(offset);
  const vendorIds = [...new Set(products.map(p => p.vendorId))];
  const vendors = vendorIds.length > 0 ? await db.select().from(vendorsTable).where(sql`id = ANY(ARRAY[${sql.join(vendorIds.map(id => sql`${id}`), sql`, `)}]::int[])`) : [];
  const userIds = vendors.map(v => v.userId);
  const users = userIds.length > 0 ? await db.select().from(usersTable).where(sql`id = ANY(ARRAY[${sql.join(userIds.map(id => sql`${id}`), sql`, `)}]::int[])`) : [];

  const vendorMap = new Map(vendors.map(v => [v.id, v]));
  const userMap = new Map(users.map(u => [u.id, u]));

  const items = await Promise.all(products.map(p => buildProductResponse(p, vendorMap, userMap)));
  res.json({ items, total, page, limit });
});

// POST /products
router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [vendor] = await db.select().from(vendorsTable).where(and(eq(vendorsTable.userId, req.user!.userId), eq(vendorsTable.status, "approved")));
  if (!vendor) {
    res.status(403).json({ error: "Vendor not approved or not found" });
    return;
  }
  const [product] = await db.insert(productsTable).values({
    vendorId: vendor.id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    price: String(parsed.data.price),
    category: parsed.data.category ?? null,
    sizes: parsed.data.sizes ?? [],
    images: parsed.data.images ?? [],
    stock: parsed.data.stock,
    isFeatured: parsed.data.isFeatured ?? false,
  }).returning();

  const vendorMap = new Map([[vendor.id, vendor]]);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, vendor.userId));
  const userMap = new Map([[user.id, user]]);
  res.status(201).json(await buildProductResponse(product, vendorMap, userMap));
});

// GET /products/featured
router.get("/products/featured", async (req, res): Promise<void> => {
  const parsed = ListFeaturedProductsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 8) : 8;
  const products = await db.select().from(productsTable).where(and(eq(productsTable.isFeatured, true), eq(productsTable.isActive, true))).orderBy(desc(productsTable.createdAt)).limit(limit);
  const result = await Promise.all(products.map(p => buildProductResponse(p)));
  res.json(result);
});

// GET /products/trending
router.get("/products/trending", async (req, res): Promise<void> => {
  const parsed = ListTrendingProductsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 8) : 8;
  const products = await db.select().from(productsTable).where(eq(productsTable.isActive, true)).orderBy(desc(productsTable.wardrobeCount)).limit(limit);
  const result = await Promise.all(products.map(p => buildProductResponse(p)));
  res.json(result);
});

// GET /products/:id
router.get("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = GetProductParams.safeParse({ id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parsed.data.id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, product.vendorId));
  const [user] = vendor ? await db.select().from(usersTable).where(eq(usersTable.id, vendor.userId)) : [undefined];
  const vendorMap = vendor ? new Map([[vendor.id, vendor]]) : new Map();
  const userMap = user ? new Map([[user.id, user]]) : new Map();
  res.json(await buildProductResponse(product, vendorMap as Map<number, typeof vendorsTable.$inferSelect>, userMap as Map<number, typeof usersTable.$inferSelect>));
});

// PATCH /products/:id
router.patch("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const paramsParsed = UpdateProductParams.safeParse({ id });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, paramsParsed.data.id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // Check ownership (vendor or admin)
  if (req.user!.role !== "admin") {
    const [vendor] = await db.select().from(vendorsTable).where(and(
      eq(vendorsTable.userId, req.user!.userId),
      eq(vendorsTable.status, "approved"),
    ));
    if (!vendor || vendor.id !== product.vendorId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.description != null) updates.description = parsed.data.description;
  if (parsed.data.price != null) updates.price = String(parsed.data.price);
  if (parsed.data.category != null) updates.category = parsed.data.category;
  if (parsed.data.sizes != null) updates.sizes = parsed.data.sizes;
  if (parsed.data.images != null) updates.images = parsed.data.images;
  if (parsed.data.stock != null) updates.stock = parsed.data.stock;
  if (req.user!.role === "admin") {
    if (parsed.data.isActive != null) updates.isActive = parsed.data.isActive;
    if (parsed.data.isFeatured != null) updates.isFeatured = parsed.data.isFeatured;
  }

  const [updated] = await db.update(productsTable).set(updates).where(eq(productsTable.id, paramsParsed.data.id)).returning();
  res.json(await buildProductResponse(updated));
});

// DELETE /products/:id
router.delete("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = DeleteProductParams.safeParse({ id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parsed.data.id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  if (req.user!.role !== "admin") {
    const [vendor] = await db.select().from(vendorsTable).where(and(
      eq(vendorsTable.userId, req.user!.userId),
      eq(vendorsTable.status, "approved"),
    ));
    if (!vendor || vendor.id !== product.vendorId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }
  await db.delete(productsTable).where(eq(productsTable.id, parsed.data.id));
  res.sendStatus(204);
});

export default router;
