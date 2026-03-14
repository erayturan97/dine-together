import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";

const router: IRouter = Router();

function generateId(): string {
  return crypto.randomBytes(16).toString("hex");
}

function generateToken(userId: string): string {
  return Buffer.from(`${userId}:${Date.now()}:${crypto.randomBytes(8).toString("hex")}`).toString("base64");
}

router.post("/guest", async (req: Request, res: Response) => {
  try {
    const { name, avatar } = req.body as { name: string; avatar?: string };
    if (!name) {
      res.status(400).json({ error: "name_required", message: "Name is required" });
      return;
    }

    const id = generateId();
    const [user] = await db
      .insert(usersTable)
      .values({
        id,
        name,
        avatar: avatar ?? null,
        provider: "guest",
      })
      .returning();

    const token = generateToken(user.id);

    res.json({ token, user: { id: user.id, name: user.name, avatar: user.avatar, provider: user.provider } });
  } catch (err) {
    console.error("Guest auth error:", err);
    res.status(500).json({ error: "internal_error", message: "Failed to create guest session" });
  }
});

router.post("/google", async (req: Request, res: Response) => {
  try {
    const { idToken, accessToken, userInfo } = req.body as {
      idToken?: string;
      accessToken?: string;
      userInfo?: { id: string; name: string; email: string; photo?: string };
    };

    if (!userInfo?.id) {
      res.status(400).json({ error: "user_info_required", message: "User info is required" });
      return;
    }

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.googleId, userInfo.id))
      .limit(1);

    let user;
    if (existing.length > 0) {
      [user] = await db
        .update(usersTable)
        .set({
          name: userInfo.name,
          email: userInfo.email,
          avatar: userInfo.photo ?? null,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, existing[0].id))
        .returning();
    } else {
      const id = generateId();
      [user] = await db
        .insert(usersTable)
        .values({
          id,
          name: userInfo.name,
          email: userInfo.email,
          avatar: userInfo.photo ?? null,
          provider: "google",
          googleId: userInfo.id,
        })
        .returning();
    }

    const token = generateToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, provider: user.provider } });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(500).json({ error: "internal_error", message: "Authentication failed" });
  }
});

export default router;
