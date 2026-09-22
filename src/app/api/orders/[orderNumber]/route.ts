import { AppError, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getOrderDetail } from "@/server/orders";

export const dynamic = "force-dynamic";

export const GET = route(async (_request, ctx: { params: Promise<{ orderNumber: string }> }) => {
  const user = await requireUser();
  const { orderNumber } = await ctx.params;
  const detail = await getOrderDetail(orderNumber.toUpperCase());
  if (!detail) throw new AppError("NOT_FOUND", "Order not found.");
  // Order access control: customers may only read their own orders.
  if (detail.order.userId !== user.id && user.role !== "ADMIN") {
    throw new AppError("FORBIDDEN", "You do not have access to this order.");
  }
  return ok({
    order: detail.order,
    items: detail.items,
    history: detail.history,
    customer: { name: detail.customerName, email: detail.customerEmail, phone: detail.customerPhone },
  });
});
