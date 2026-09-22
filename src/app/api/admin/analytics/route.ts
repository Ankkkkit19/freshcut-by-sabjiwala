import { ok, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getAnalytics, resolveRange } from "@/server/analytics";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const range = resolveRange({
    range: url.searchParams.get("range"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });
  const analytics = await getAnalytics(range);
  return ok({ range, analytics });
});
