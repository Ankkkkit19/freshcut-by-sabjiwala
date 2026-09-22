import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { addresses, users } from "@/db/schema";
import { ok, parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/utils";
import { profileUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser();
  const list = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, user.id))
    .orderBy(asc(addresses.id));
  return ok({ user, addresses: list });
});

export const PATCH = route(async (request) => {
  const user = await requireUser();
  const body = await parseBody(request, profileUpdateSchema);
  const phone = body.phone ? normalizePhone(body.phone) : undefined;
  const updated = await db
    .update(users)
    .set({
      ...(body.name ? { name: body.name } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      imageUrl: users.imageUrl,
      role: users.role,
    });
  return ok({ user: updated[0] });
});
