import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { verifyToken, type JwtPayload } from "../lib/auth";
import { hasActiveAccount } from "../lib/security-boundaries";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const tokenUser = verifyToken(token);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, tokenUser.userId));
    if (!user) {
      res.status(401).json({ error: "Account no longer exists" });
      return;
    }
    if (!hasActiveAccount(user.isSuspended)) {
      res.status(403).json({ error: "This account is currently suspended. Contact Rare District support for help." });
      return;
    }
    req.user = { ...tokenUser, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const tokenUser = verifyToken(authHeader.slice(7));
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, tokenUser.userId));
      if (user && hasActiveAccount(user.isSuspended)) req.user = { ...tokenUser, role: user.role };
    } catch {
      // ignore invalid token — user is just unauthenticated
    }
  }
  next();
}
