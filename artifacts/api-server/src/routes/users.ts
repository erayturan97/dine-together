import { Router, type IRouter, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, ilike, or, ne, inArray } from "drizzle-orm";
import { type AuthRequest, authMiddleware } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    provider: user.provider,
  });
});

router.get("/friends", authMiddleware, async (req: AuthRequest, res: Response) => {
  const users = await db
    .select()
    .from(usersTable)
    .where(ne(usersTable.id, req.userId!))
    .limit(50);

  res.json(users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatar: u.avatar,
    provider: u.provider,
  })));
});

router.get("/search", authMiddleware, async (req: AuthRequest, res: Response) => {
  const q = (req.query.q as string) ?? "";
  if (!q || q.length < 2) {
    res.json([]);
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(
      or(
        ilike(usersTable.name, `%${q}%`),
        ilike(usersTable.email ?? "", `%${q}%`)
      )
    )
    .limit(20);

  res.json(users
    .filter(u => u.id !== req.userId)
    .map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      provider: u.provider,
    })));
});

router.post("/contacts-match", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { phones, emails } = req.body as { phones?: string[]; emails?: string[] };
    const conditions: any[] = [];

    const normalizePhone = (p: string) => p.replace(/\D/g, '');
    const normalizedPhones = (phones ?? []).map(normalizePhone).filter(p => p.length >= 7);

    if (normalizedPhones.length > 0 || (emails ?? []).length > 0) {
      const allUsers = await db.select().from(usersTable).where(ne(usersTable.id, req.userId!));

      const matched = allUsers.filter(u => {
        if (u.email && (emails ?? []).includes(u.email)) return true;
        if (u.phone) {
          const norm = normalizePhone(u.phone);
          if (normalizedPhones.some(p => norm.endsWith(p.slice(-9)) || p.endsWith(norm.slice(-9)))) return true;
        }
        return false;
      });

      res.json(matched.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        provider: u.provider,
      })));
      return;
    }

    res.json([]);
  } catch (err) {
    console.error("Contacts match error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
