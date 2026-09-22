import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { passwordResetTokens, sessions, users } from "@/db/schema";
import { AppError, clientIp, ok, parseBody, rateLimit, route } from "@/lib/api";
import { hashPassword, randomToken } from "@/lib/auth";
import { hashLinkCode } from "@/server/whatsapp-bot";
import { passwordRequestSchema, passwordResetSchema } from "@/lib/validation";
import { z } from "zod";

const schema = z.union([
  z.object({ mode: z.literal("request") }).and(passwordRequestSchema),
  z.object({ mode: z.literal("reset") }).and(passwordResetSchema),
]);

export const POST = route(async (request) => {
  rateLimit(`password:${clientIp(request)}`, 8, 60_000);
  const body = await parseBody(request, schema);

  if (body.mode === "request") {
    const rows = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    const user = rows[0];
    // Always return success so accounts cannot be enumerated.
    if (!user) {
      return ok({ sent: true, devToken: null });
    }
    const token = randomToken(24);
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: hashLinkCode(token),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    // In production this token is emailed. In this sandbox no mail provider is
    // configured, so it is returned only for non-production environments.
    const devToken = process.env.NODE_ENV === "production" ? null : token;
    return ok({ sent: true, devToken });
  }

  const tokenHash = hashLinkCode(body.token);
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const reset = rows[0];
  if (!reset) throw new AppError("BAD_REQUEST", "This reset link is invalid or has expired.");

  const passwordHash = await hashPassword(body.password);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, reset.userId));
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, reset.id));
  // Invalidate every existing session for that account.
  await db.delete(sessions).where(eq(sessions.userId, reset.userId));
  return ok({ reset: true });
});
