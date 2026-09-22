import { ok, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { listOrdersAdmin } from "@/server/orders";
import type { OrderStatus } from "@/db/schema";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const result = await listOrdersAdmin({
    status: (url.searchParams.get("status") as OrderStatus | "ALL") ?? "ALL",
    q: url.searchParams.get("q") ?? undefined,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
    page: Number(url.searchParams.get("page") ?? 1),
    pageSize: Number(url.searchParams.get("pageSize") ?? 20),
  });
  return ok(result);
});
