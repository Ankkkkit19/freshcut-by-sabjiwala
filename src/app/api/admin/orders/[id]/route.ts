import { AppError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { orderStatusSchema } from "@/lib/validation";
import { getOrderDetail, updateOrderStatus } from "@/server/orders";

export const dynamic = "force-dynamic";

export const GET = route(async (_request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const detail = await getOrderDetail(id.toUpperCase());
  if (!detail) throw new AppError("NOT_FOUND", "Order not found.");
  return ok({
    order: detail.order,
    items: detail.items,
    history: detail.history,
    customer: { name: detail.customerName, email: detail.customerEmail, phone: detail.customerPhone },
  });
});

export const PATCH = route(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const body = await parseBody(request, orderStatusSchema);
  const result = await updateOrderStatus({
    orderNumber: id.toUpperCase(),
    status: body.status,
    actor: { id: admin.id, label: admin.email },
    source: "WEB",
    reason: body.reason ?? null,
  });
  return ok({ order: result.order, unchanged: result.unchanged });
});
