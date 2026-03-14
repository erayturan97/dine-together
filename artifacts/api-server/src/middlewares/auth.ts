import { type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  userId?: string;
  user?: typeof usersTable.$inferSelect;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "Missing auth token" });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [userId] = decoded.split(":");

    if (!userId) {
      res.status(401).json({ error: "unauthorized", message: "Invalid token" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(401).json({ error: "unauthorized", message: "User not found" });
      return;
    }

    req.userId = userId;
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "unauthorized", message: "Invalid token" });
  }
}
