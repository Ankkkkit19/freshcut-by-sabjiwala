import { z } from "zod";
import { ok, parseBody, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { adjustStock, listLowStock, listStockOverview, listStockTransactions, produceFromRaw } from "@/server/inventory";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  const [overview, transactions, lowStock] = await Promise.all([
    listStockOverview(),
    listStockTransactions(40),
    listLowStock(20),
  ]);
  return ok({ overview, transactions, lowStock });
});

const adjustSchema = z.object({
  mode: z.enum(["adjust", "produce"]).default("adjust"),
  variantId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().refine((v) => v !== 0, "Quantity cannot be zero"),
  type: z
    .enum(["RAW", "PREPARED", "RESERVED", "SOLD", "DAMAGED", "WASTAGE", "RETURN", "ADJUSTMENT"])
    .default("ADJUSTMENT"),
  reason: z.string().trim().max(200).optional(),
});

export const POST = route(async (request) => {
  const admin = await requireAdmin();
  const body = await parseBody(request, adjustSchema);

  if (body.mode === "produce") {
    const result = await produceFromRaw({
      variantId: body.variantId,
      rawKg: Math.abs(body.quantity),
      reason: body.reason || "Raw intake converted to prepared stock",
      actorUserId: admin.id,
      source: "ADMIN",
    });
    await recordAudit({
      actorUserId: admin.id,
      actorLabel: admin.email,
      action: "STOCK_PRODUCED",
      resource: "product_variant",
      resourceId: body.variantId,
      newValue: { rawKg: Math.abs(body.quantity), preparedBalance: result.balanceAfter },
    });
    return ok({ result }, 201);
  }

  const result = await adjustStock({
    variantId: body.variantId,
    type: body.type,
    quantity: body.type === "DAMAGED" || body.type === "WASTAGE" ? Math.abs(body.quantity) : body.quantity,
    reason: body.reason || "Manual stock adjustment",
    actorUserId: admin.id,
    source: "ADMIN",
  });
  await recordAudit({
    actorUserId: admin.id,
    actorLabel: admin.email,
    action: "STOCK_UPDATED",
    resource: "product_variant",
    resourceId: body.variantId,
    newValue: { type: body.type, delta: result.delta, balanceAfter: result.balanceAfter, reason: body.reason },
  });
  return ok({ result }, 201);
});
