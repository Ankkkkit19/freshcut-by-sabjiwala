import { ok, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getDashboardStats, resolveRange } from "@/server/analytics";
import { listLowStock } from "@/server/inventory";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const range = resolveRange({
    range: url.searchParams.get("range"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });
  const [stats, lowStock] = await Promise.all([getDashboardStats(range), listLowStock(8)]);
  return ok({ range: { ...range, key: range.key }, stats, lowStock });
});
