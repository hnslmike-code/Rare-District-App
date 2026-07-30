import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { RegisterUserBody, LoginUserBody, UpdateMyProfileBody } from "@workspace/api-zod";
import { signToken, hashPassword, comparePassword, generateReferralCode } from "../lib/auth";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// POST /auth/register
router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password, name, role, referralCode: usedReferralCode } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await hashPassword(password);
  let referralCode = generateReferralCode();
  // Ensure uniqueness
  while ((await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode))).length > 0) {
    referralCode = generateReferralCode();
  }

  const [user] = await db.insert(usersTable).values({
    email,
    name,
    passwordHash,
    role: (role as "shopper" | "vendor") ?? "shopper",
    referralCode,
    referredBy: usedReferralCode ?? null,
  }).returning();

  if (usedReferralCode) {
    const [referrer] = await db.select().from(usersTable).where(eq(usersTable.referralCode, usedReferralCode));
    if (referrer) {
      const { referralsTable, rewardsTable } = await import("@workspace/db");
      await db.insert(referralsTable).values({ referrerId: referrer.id, referredId: user.id });
      await db.insert(rewardsTable).values({ userId: referrer.id, type: "referral_signup", status: "issued" });
      await db.insert(rewardsTable).values({ userId: user.id, type: "referral_signup", status: "issued" });
    }
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, referralCode: user.referralCode, referredBy: user.referredBy, createdAt: user.createdAt },
  });
});

// POST /auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, referralCode: user.referralCode, referredBy: user.referredBy, createdAt: user.createdAt },
  });
});

// POST /auth/logout
router.post("/auth/logout", (_req, res): void => {
  res.json({ success: true });
});

// GET /auth/me
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, referralCode: user.referralCode, referredBy: user.referredBy, createdAt: user.createdAt });
});

// PATCH /auth/me/profile
router.patch("/auth/me/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.avatarUrl != null) updates.avatarUrl = parsed.data.avatarUrl;

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.user!.userId)).returning();
  res.json({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, referralCode: user.referralCode, referredBy: user.referredBy, createdAt: user.createdAt });
});

// GET /auth/google — redirect to Google
router.get("/auth/google", (req, res): void => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || clientId.startsWith("placeholder")) {
    res.status(501).json({ error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
    return;
  }
  const redirectUri = `${process.env.FRONTEND_URL ?? ""}/api/auth/google/callback`;
  const scope = "openid email profile";
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
  res.redirect(url);
});

// GET /auth/google/callback
router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const { code } = req.query as { code?: string };
  if (!code) {
    res.redirect("/?error=google_auth_failed");
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri = `${process.env.FRONTEND_URL ?? ""}/api/auth/google/callback`;

  try {
    // Exchange code for token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) throw new Error("No access token");

    // Fetch user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json() as { sub: string; email: string; name?: string; picture?: string };

    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, googleUser.email));
    if (!user) {
      const referralCode = generateReferralCode();
      [user] = await db.insert(usersTable).values({
        email: googleUser.email,
        name: googleUser.name,
        googleId: googleUser.sub,
        avatarUrl: googleUser.picture,
        role: "shopper",
        referralCode,
      }).returning();
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    const frontendUrl = process.env.FRONTEND_URL ?? "";
    res.redirect(`${frontendUrl}/?token=${token}`);
  } catch (err) {
    req.log.error({ err }, "Google OAuth callback error");
    res.redirect("/?error=google_auth_failed");
  }
});

export default router;
