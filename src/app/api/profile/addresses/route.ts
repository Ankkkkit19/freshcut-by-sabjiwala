import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { ok, parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/utils";
import { addressSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser();
  const list = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, user.id))
    .orderBy(sql`${addresses.isDefault} DESC`, addresses.id);
  return ok({ addresses: list });
});

export const POST = route(async (request) => {
  const user = await requireUser();
  const body = await parseBody(request, addressSchema);
  const existing = await db
    .select({ id: addresses.id })
    .from(addresses)
    .where(eq(addresses.userId, user.id));
  const makeDefault = body.isDefault || existing.length === 0;

  const created = await db.transaction(async (tx) => {
    if (makeDefault) {
      await tx
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, user.id));
    }
    const rows = await tx
      .insert(addresses)
      .values({
        userId: user.id,
        fullName: body.fullName,
        phone: normalizePhone(body.phone) ?? body.phone,
        line1: body.line1,
        street: body.street || null,
        area: body.area,
        city: body.city,
        state: body.state,
        pincode: body.pincode,
        landmark: body.landmark || null,
        type: body.type,
        isDefault: makeDefault,
      })
      .returning();
    return rows[0]!;
  });
  return ok({ address: created }, 201);
});

export const PATCH = route(async (request) => {
  const user = await requireUser();
  const body = await parseBody(request, addressSchema.partial().extend({ id: addressSchema.shape.line1.optional() }));
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return ok({ updated: false });
  const rows = await db
    .update(addresses)
    .set({
      ...(body.fullName ? { fullName: body.fullName } : {}),
      ...(body.phone ? { phone: normalizePhone(body.phone) ?? body.phone } : {}),
      ...(body.line1 ? { line1: body.line1 } : {}),
      ...(body.area ? { area: body.area } : {}),
      ...(body.city ? { city: body.city } : {}),
      ...(body.state ? { state: body.state } : {}),
      ...(body.pincode ? { pincode: body.pincode } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(addresses.id, Number(id)), eq(addresses.userId, user.id)))
    .returning();
  return ok({ address: rows[0] ?? null });
});
