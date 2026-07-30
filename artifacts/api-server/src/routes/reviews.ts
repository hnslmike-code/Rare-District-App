import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, reviewsTable, usersTable } from "@workspace/db";
import { GetProductReviewsParams, CreateReviewBody, CreateReviewParams } from "@workspace/api-zod";
import { requireAuth, optionalAuth } from "../middlewares/auth";

const router: IRouter = Router();

// GET /products/:id/reviews
router.get("/products/:id/reviews", optionalAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = GetProductReviewsParams.safeParse({ id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }
  const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.productId, parsed.data.id));
  const result = await Promise.all(reviews.map(async (r) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, r.userId));
    return {
      id: r.id, productId: r.productId, userId: r.userId, rating: r.rating, comment: r.comment, createdAt: r.createdAt,
      user: user ? { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, referralCode: user.referralCode, referredBy: user.referredBy, createdAt: user.createdAt } : undefined,
    };
  }));
  res.json(result);
});

// POST /products/:id/reviews
router.post("/products/:id/reviews", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const paramsParsed = CreateReviewParams.safeParse({ id });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [review] = await db.insert(reviewsTable).values({
    productId: paramsParsed.data.id,
    userId: req.user!.userId,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? null,
  }).returning();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  res.status(201).json({
    id: review.id, productId: review.productId, userId: review.userId,
    rating: review.rating, comment: review.comment, createdAt: review.createdAt,
    user: user ? { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, referralCode: user.referralCode, referredBy: user.referredBy, createdAt: user.createdAt } : undefined,
  });
});

export default router;
