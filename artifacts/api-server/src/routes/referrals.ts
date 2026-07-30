import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, referralsTable, rewardsTable, shareLinksTable, couponsTable, usersTable } from "@workspace/db";
import { GenerateShareLinkBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { generateShareCode } from "../lib/auth";

const router: IRouter = Router();

// GET /referrals/me
router.get("/referrals/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const referrals = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, req.user!.userId));
  const rewards = await db.select().from(rewardsTable).where(eq(rewardsTable.userId, req.user!.userId));
  const completed = referrals.filter(r => r.status === "completed").length;
  const issued = rewards.filter(r => r.status === "issued" || r.status === "redeemed").length;
  const pending = rewards.filter(r => r.status === "pending").length;

  const frontendUrl = process.env.FRONTEND_URL ?? "";
  res.json({
    referralCode: user.referralCode,
    referralLink: `${frontendUrl}/register?ref=${user.referralCode}`,
    totalReferrals: referrals.length,
    successfulReferrals: completed,
    totalRewards: issued,
    pendingRewards: pending,
  });
});

// GET /referrals/rewards
router.get("/referrals/rewards", requireAuth, async (req, res): Promise<void> => {
  const rewards = await db.select().from(rewardsTable).where(eq(rewardsTable.userId, req.user!.userId));
  const result = await Promise.all(rewards.map(async (r) => {
    let couponCode: string | null = null;
    let couponValue: number | null = null;
    if (r.couponId) {
      const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.id, r.couponId));
      couponCode = coupon?.code ?? null;
      couponValue = coupon ? parseFloat(coupon.value) : null;
    }
    return { id: r.id, type: r.type, couponCode, couponValue, status: r.status, createdAt: r.createdAt };
  }));
  res.json(result);
});

// POST /referrals/share
router.post("/referrals/share", requireAuth, async (req, res): Promise<void> => {
  const parsed = GenerateShareLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Check for existing share link
  const [existing] = await db.select().from(shareLinksTable)
    .where(and(eq(shareLinksTable.userId, req.user!.userId), eq(shareLinksTable.productId, parsed.data.productId)));

  if (existing) {
    const frontendUrl = process.env.FRONTEND_URL ?? "";
    res.json({ url: `${frontendUrl}/product/${parsed.data.productId}?share=${existing.shareCode}`, shareCode: existing.shareCode });
    return;
  }

  const shareCode = generateShareCode();
  await db.insert(shareLinksTable).values({
    userId: req.user!.userId,
    productId: parsed.data.productId,
    shareCode,
  });

  const frontendUrl = process.env.FRONTEND_URL ?? "";
  res.json({ url: `${frontendUrl}/product/${parsed.data.productId}?share=${shareCode}`, shareCode });
});

export default router;
