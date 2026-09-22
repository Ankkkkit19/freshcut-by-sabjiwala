import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AppError, ok, parseBody, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { listCustomers } from "@/server/analytics";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const customers = await listCustomers({
    q: url.searchParams.get("q"),
    limit: Number(url.searchParams.get("limit") ?? 25),
    offset: Number(url.searchParams.get("offset") ?? 0),
  });
  return ok({ customers });
});

export const PATCH = route(async (request) => {
  const admin = await requireAdmin();
  const body = await parseBody(request, z.object({ id: z.coerce.number().int().positive(), isActive: z.boolean() }));
  const before = await db.select().from(users).where(eq(users.id, body.id)).limit(1);
  if (!before[0]) throw new AppError("NOT_FOUND", "Customer not found.");
  await db.update(users).set({ isActive: body.isActive, updatedAt: new Date() }).where(eq(users.id, body.id));
  await recordAudit({
    actorUserId: admin.id,
    actorLabel: admin.email,
    action: body.isActive ? "CUSTOMER_ENABLED" : "CUSTOMER_DISABLED",
    resource: "user",
    resourceId: body.id,
    previousValue: { isActive: before[0].isActive },
    newValue: { isActive: body.isActive },
  });
  return ok({ updated: true });
});
