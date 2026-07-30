import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, wardrobeItemsTable, productsTable, vendorsTable, usersTable } from "@workspace/db";
import { AddToWardrobeBody, RemoveFromWardrobeParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

async function formatItem(item: typeof wardrobeItemsTable.$inferSelect) {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
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
    id: item.id, userId: item.userId, productId: item.productId,
    selectedSize: item.selectedSize, quantity: item.quantity, addedAt: item.addedAt,
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
  // Check if already in wardrobe
  const [existing] = await db.select().from(wardrobeItemsTable)
    .where(and(eq(wardrobeItemsTable.userId, req.user!.userId), eq(wardrobeItemsTable.productId, parsed.data.productId)));

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
    selectedSize: parsed.data.selectedSize ?? null,
    quantity: parsed.data.quantity ?? 1,
  }).returning();

  // Increment wardrobe count on product
  await db.update(productsTable).set({ wardrobeCount: sql`wardrobe_count + 1` }).where(eq(productsTable.id, parsed.data.productId));

  res.status(201).json(await formatItem(item));
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
