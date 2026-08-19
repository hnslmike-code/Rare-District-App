import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, wardrobeItemsTable, productsTable, productVariantsTable, vendorsTable, usersTable } from "@workspace/db";
import { AddToWardrobeBody, RemoveFromWardrobeParams, RemoveWardrobeItemParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

async function formatItem(item: typeof wardrobeItemsTable.$inferSelect) {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
  const [variant] = item.variantId
    ? await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, item.variantId))
    : [undefined];
  let vendor: typeof vendorsTable.$inferSelect | undefined;
  let user: typeof usersTable.$inferSelect | undefined;
  if (product) {
    const vendorRows = await db.select().from(vendorsTable).where(eq(vendorsTable.id, product.vendorId));
    vendor = vendorRows[0];
    if (vendor) {
      const userRows = await db.select().from(usersTable).where(eq(usersTable.id, vendor.userId));
      user = userRows[0];
    }
  }
  return {
    id: item.id, userId: item.userId, productId: item.productId, variantId: item.variantId,
    selectedSize: item.selectedSize, quantity: item.quantity, addedAt: item.addedAt,
    variant: variant ? {
      id: variant.id, productId: variant.productId, sku: variant.sku, attributes: variant.attributes,
      priceAdjustment: Number(variant.priceAdjustment), stock: variant.stock, reservedStock: variant.reservedStock,
      availableStock: variant.stock - variant.reservedStock, isActive: variant.isActive, createdAt: variant.createdAt,
    } : undefined,
    product: product ? {
      id: product.id, vendorId: product.vendorId, name: product.name, description: product.description,
      price: parseFloat(product.price), currency: product.currency, category: product.category,
      sizes: product.sizes, images: product.images, stock: product.stock, isActive: product.isActive,
      isFeatured: product.isFeatured, wardrobeCount: product.wardrobeCount,
      averageRating: null, reviewCount: 0, createdAt: product.createdAt,
      vendor: vendor ? {
        id: vendor.id, userId: vendor.userId, brandName: vendor.brandName, description: vendor.description,
        logoUrl: vendor.logoUrl, website: vendor.website, bankName: null, accountNumber: null, accountName: null,
        status: vendor.status, commissionRateOverride: null, payoutBalance: parseFloat(vendor.payoutBalance ?? "0"),
        adminNote: null, createdAt: vendor.createdAt,
        user: user ? { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, referralCode: user.referralCode, referredBy: user.referredBy, createdAt: user.createdAt } : undefined,
      } : undefined,
    } : undefined,
  };
}

// GET /wardrobe
router.get("/wardrobe", requireAuth, async (req, res): Promise<void> => {
  const items = await db.select().from(wardrobeItemsTable).where(eq(wardrobeItemsTable.userId, req.user!.userId));
  res.json(await Promise.all(items.map(formatItem)));
});

// POST /wardrobe
router.post("/wardrobe", requireAuth, async (req, res): Promise<void> => {
  const parsed = AddToWardrobeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parsed.data.productId));
  if (!product || !product.isActive) {
    res.status(404).json({ error: "Product is unavailable." });
    return;
  }
  const variants = await db.select({ id: productVariantsTable.id }).from(productVariantsTable)
    .where(eq(productVariantsTable.productId, product.id)).limit(1);
  const variantId = parsed.data.variantId;
  let variant: typeof productVariantsTable.$inferSelect | undefined;
  if (variantId) {
    [variant] = await db.select().from(productVariantsTable).where(and(
      eq(productVariantsTable.id, variantId),
      eq(productVariantsTable.productId, product.id),
      eq(productVariantsTable.isActive, true),
    ));
    if (!variant) {
      res.status(409).json({ error: "That product variant is unavailable." });
      return;
    }
  } else if (variants.length) {
    res.status(409).json({ error: "Select a product variant before adding this item." });
    return;
  }
  // Check if already in wardrobe
  const [existing] = await db.select().from(wardrobeItemsTable)
    .where(and(
      eq(wardrobeItemsTable.userId, req.user!.userId),
      eq(wardrobeItemsTable.productId, parsed.data.productId),
      variantId ? eq(wardrobeItemsTable.variantId, variantId) : isNull(wardrobeItemsTable.variantId),
    ));

  if (existing) {
    // Update quantity
    const [updated] = await db.update(wardrobeItemsTable)
      .set({ quantity: existing.quantity + (parsed.data.quantity ?? 1), selectedSize: parsed.data.selectedSize ?? existing.selectedSize })
      .where(eq(wardrobeItemsTable.id, existing.id)).returning();
    res.status(201).json(await formatItem(updated));
    return;
  }

  const [item] = await db.insert(wardrobeItemsTable).values({
    userId: req.user!.userId,
    productId: parsed.data.productId,
    variantId: variant?.id ?? null,
    selectedSize: parsed.data.selectedSize ?? null,
    quantity: parsed.data.quantity ?? 1,
  }).returning();

  // Increment wardrobe count on product
  await db.update(productsTable).set({ wardrobeCount: sql`wardrobe_count + 1` }).where(eq(productsTable.id, parsed.data.productId));

  res.status(201).json(await formatItem(item));
});

// DELETE /wardrobe/items/:id
router.delete("/wardrobe/items/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = RemoveWardrobeItemParams.safeParse({ id: Number(raw) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid wardrobe item id" });
    return;
  }
  await db.delete(wardrobeItemsTable).where(and(
    eq(wardrobeItemsTable.id, parsed.data.id),
    eq(wardrobeItemsTable.userId, req.user!.userId),
  ));
  res.sendStatus(204);
});

// DELETE /wardrobe/:productId
router.delete("/wardrobe/:productId", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);
  const parsed = RemoveFromWardrobeParams.safeParse({ productId });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }
  await db.delete(wardrobeItemsTable)
    .where(and(eq(wardrobeItemsTable.userId, req.user!.userId), eq(wardrobeItemsTable.productId, parsed.data.productId)));
  res.sendStatus(204);
});

export default router;
