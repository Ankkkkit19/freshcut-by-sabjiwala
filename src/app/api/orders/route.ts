import { ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listUserOrders } from "@/server/orders";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser();
  const orders = await listUserOrders(user.id);
  return ok({ orders });
});
