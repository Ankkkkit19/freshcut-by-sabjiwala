import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { whatsappIdentities, whatsappLinkTokens } from "@/db/schema";
import { AppError, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { generateLinkCode, hashLinkCode } from "@/server/whatsapp-bot";
import { getStoreSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser();
  const rows = await db
    .select({ phone: whatsappIdentities.phone, verifiedAt: whatsappIdentities.verifiedAt })
    .from(whatsappIdentities)
    .where(eq(whatsappIdentities.userId, user.id))
    .limit(1);
  return ok({ identity: rows[0] ?? null });
});

/**
 * Issues a one-time, expiring link code. The code is stored hashed and can only
 * be redeemed from WhatsApp - it is never trusted as an identity on its own.
 */
export const POST = route(async () => {
  const user = await requireUser();
  const settings = await getStoreSettings();
  const active = await db
    .select({ id: whatsappLinkTokens.id })
    .from(whatsappLinkTokens)
    .where(
      and(
        eq(whatsappLinkTokens.userId, user.id),
        isNull(whatsappLinkTokens.usedAt),
        gt(whatsappLinkTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (active[0]) {
    throw new AppError("CONFLICT", "You already have an active link code. Check your WhatsApp inbox.");
  }

  const alreadyLinked = await db
    .select({ phone: whatsappIdentities.phone })
    .from(whatsappIdentities)
    .where(eq(whatsappIdentities.userId, user.id))
    .limit(1);

  const code = generateLinkCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await db.insert(whatsappLinkTokens).values({
    userId: user.id,
    tokenHash: hashLinkCode(code),
    expiresAt,
  });

  const message = `link ${code}`;
  return ok(
    {
      code,
      expiresAt,
      alreadyLinkedTo: alreadyLinked[0]?.phone ?? null,
      whatsappNumber: settings.whatsappNumber,
      deepLink: `https://wa.me/${settings.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
      instructions: `Send "link ${code}" to ${settings.whatsappNumber} on WhatsApp.`,
    },
    201,
  );
});

export const DELETE = route(async () => {
  const user = await requireUser();
  const removed = await db
    .delete(whatsappIdentities)
    .where(eq(whatsappIdentities.userId, user.id))
    .returning({ phone: whatsappIdentities.phone });
  await db
    .update(whatsappLinkTokens)
    .set({ usedAt: sql`now()` })
    .where(and(eq(whatsappLinkTokens.userId, user.id), isNull(whatsappLinkTokens.usedAt)));
  return ok({ unlinked: removed[0]?.phone ?? null });
});
