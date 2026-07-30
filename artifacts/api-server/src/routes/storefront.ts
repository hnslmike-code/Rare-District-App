import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, productsTable, vendorsTable, usersTable, categoriesTable } from "@workspace/db";

const router: IRouter = Router();

// GET /storefront/summary
router.get("/storefront/summary", async (_req, res): Promise<void> => {
  const [featuredProducts, trendingProducts, categories, featuredVendors] = await Promise.all([
    db.select().from(productsTable).where(and(eq(productsTable.isFeatured, true), eq(productsTable.isActive, true))).orderBy(desc(productsTable.createdAt)).limit(8),
    db.select().from(productsTable).where(eq(productsTable.isActive, true)).orderBy(desc(productsTable.wardrobeCount)).limit(8),
    db.select().from(categoriesTable).orderBy(categoriesTable.name),
    db.select().from(vendorsTable).where(eq(vendorsTable.status, "approved")).orderBy(desc(vendorsTable.createdAt)).limit(6),
  ]);

  const formatProduct = (p: typeof productsTable.$inferSelect) => ({
    id: p.id, vendorId: p.vendorId, name: p.name, description: p.description,
    price: parseFloat(p.price), currency: p.currency, category: p.category,
    sizes: p.sizes, images: p.images, stock: p.stock, isActive: p.isActive,
    isFeatured: p.isFeatured, wardrobeCount: p.wardrobeCount,
    averageRating: null, reviewCount: 0, createdAt: p.createdAt,
  });

  const vendorUsers = await Promise.all(featuredVendors.map(async (v) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, v.userId));
    return { vendor: v, user };
  }));

  res.json({
    featuredProducts: featuredProducts.map(formatProduct),
    trendingProducts: trendingProducts.map(formatProduct),
    categories: categories.map(c => ({ id: c.id, name: c.name, slug: c.slug, imageUrl: c.imageUrl, productCount: 0 })),
    featuredVendors: vendorUsers.map(({ vendor: v, user }) => ({
      id: v.id, userId: v.userId, brandName: v.brandName, description: v.description,
      logoUrl: v.logoUrl, website: v.website, bankName: null, accountNumber: null, accountName: null,
      status: v.status, commissionRateOverride: null,
      payoutBalance: parseFloat(v.payoutBalance ?? "0"), adminNote: null, createdAt: v.createdAt,
      user: user ? { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, referralCode: user.referralCode, referredBy: user.referredBy, createdAt: user.createdAt } : undefined,
    })),
  });
});

export default router;
