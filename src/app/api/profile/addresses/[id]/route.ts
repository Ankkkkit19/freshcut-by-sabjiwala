import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { AppError, ok, parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/utils";
import { addressSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const PATCH = route(
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await parseBody(request, addressSchema.partial());
    const addressId = Number(id);
    if (!Number.isInteger(addressId)) throw new AppError("BAD_REQUEST", "Invalid address id.");

    const existing = await db
      .select({ id: addresses.id })
      .from(addresses)
      .where(and(eq(addresses.id, addressId), eq(addresses.userId, user.id)))
      .limit(1);
    if (!existing[0]) throw new AppError("NOT_FOUND", "Address not found.");

    const updated = await db.transaction(async (tx) => {
      if (body.isDefault) {
        await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
      }
      const rows = await tx
        .update(addresses)
        .set({
          ...(body.fullName ? { fullName: body.fullName } : {}),
          ...(body.phone ? { phone: normalizePhone(body.phone) ?? body.phone } : {}),
          ...(body.line1 ? { line1: body.line1 } : {}),
          ...(body.street !== undefined ? { street: body.street || null } : {}),
          ...(body.area ? { area: body.area } : {}),
          ...(body.city ? { city: body.city } : {}),
          ...(body.state ? { state: body.state } : {}),
          ...(body.pincode ? { pincode: body.pincode } : {}),
          ...(body.landmark !== undefined ? { landmark: body.landmark || null } : {}),
          ...(body.type ? { type: body.type } : {}),
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(addresses.id, addressId), eq(addresses.userId, user.id)))
        .returning();
      return rows[0]!;
    });
    return ok({ address: updated });
  },
);

export const DELETE = route(
  async (_request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const addressId = Number(id);
    const deleted = await db
      .delete(addresses)
      .where(and(eq(addresses.id, addressId), eq(addresses.userId, user.id)))
      .returning({ id: addresses.id, isDefault: addresses.isDefault });
    if (deleted.length === 0) throw new AppError("NOT_FOUND", "Address not found.");
    if (deleted[0]!.isDefault) {
      const remaining = await db
        .select({ id: addresses.id })
        .from(addresses)
        .where(eq(addresses.userId, user.id))
        .limit(1);
      if (remaining[0]) {
        await db.update(addresses).set({ isDefault: true }).where(eq(addresses.id, remaining[0].id));
      }
    }
    return ok({ deleted: true });
  },
);
