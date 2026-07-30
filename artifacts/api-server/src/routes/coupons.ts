import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, couponsTable } from "@workspace/db";
import { ValidateCouponBody, CreateCouponBody, UpdateCouponBody, UpdateCouponParams, DeleteCouponParams } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

function formatCoupon(c: typeof couponsTable.$inferSelect) {
  return {
    id: c.id, code: c.code, type: c.type, value: parseFloat(c.value),
    minOrderAmount: c.minOrderAmount ? parseFloat(c.minOrderAmount) : null,
    maxUses: c.maxUses, usedCount: c.usedCount,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    isActive: c.isActive, isReferral: c.isReferral, createdAt: c.createdAt,
  };
}

// POST /coupons/validate
router.post("/coupons/validate", requireAuth, async (req, res): Promise<void> => {
  const parsed = ValidateCouponBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { code, orderTotal } = parsed.data;
  const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, code.toUpperCase()));

  if (!coupon || !coupon.isActive) {
    res.status(400).json({ error: "Invalid or inactive coupon" });
    return;
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    res.status(400).json({ error: "Coupon has expired" });
    return;
  }
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    res.status(400).json({ error: "Coupon usage limit reached" });
    return;
  }
  if (coupon.minOrderAmount && orderTotal < parseFloat(coupon.minOrderAmount)) {
    res.status(400).json({ error: `Minimum order amount is ₦${parseFloat(coupon.minOrderAmount).toLocaleString()}` });
    return;
  }

  const value = parseFloat(coupon.value);
  const discountAmount = coupon.type === "percentage" ? (orderTotal * value) / 100 : Math.min(value, orderTotal);
  const finalTotal = Math.max(0, orderTotal - discountAmount);

  res.json({ valid: true, discountAmount, finalTotal, coupon: formatCoupon(coupon) });
});

// GET /coupons (admin)
router.get("/coupons", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const coupons = await db.select().from(couponsTable).orderBy(couponsTable.createdAt);
  res.json(coupons.map(formatCoupon));
});

// POST /coupons (admin)
router.post("/coupons", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateCouponBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [coupon] = await db.insert(couponsTable).values({
    code: parsed.data.code.toUpperCase(),
    type: parsed.data.type,
    value: String(parsed.data.value),
    minOrderAmount: parsed.data.minOrderAmount ? String(parsed.data.minOrderAmount) : null,
    maxUses: parsed.data.maxUses ?? null,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
  }).returning();
  res.status(201).json(formatCoupon(coupon));
});

// PATCH /coupons/:id (admin)
router.patch("/coupons/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const paramsParsed = UpdateCouponParams.safeParse({ id });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid coupon id" });
    return;
  }
  const parsed = UpdateCouponBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.value != null) updates.value = String(parsed.data.value);
  if (parsed.data.minOrderAmount != null) updates.minOrderAmount = String(parsed.data.minOrderAmount);
  if (parsed.data.maxUses != null) updates.maxUses = parsed.data.maxUses;
  if (parsed.data.expiresAt != null) updates.expiresAt = new Date(parsed.data.expiresAt);
  if (parsed.data.isActive != null) updates.isActive = parsed.data.isActive;

  const [coupon] = await db.update(couponsTable).set(updates).where(eq(couponsTable.id, paramsParsed.data.id)).returning();
  res.json(formatCoupon(coupon));
});

// DELETE /coupons/:id (admin)
router.delete("/coupons/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = DeleteCouponParams.safeParse({ id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid coupon id" });
    return;
  }
  await db.delete(couponsTable).where(eq(couponsTable.id, parsed.data.id));
  res.sendStatus(204);
});

export default router;
