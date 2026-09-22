import { ok, route } from "@/lib/api";
import { listProducts, searchSuggestions } from "@/server/catalog";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  if (url.searchParams.get("suggest") === "true") {
    const suggestions = await searchSuggestions(q, 6);
    return ok({ suggestions });
  }
  const page = Number(url.searchParams.get("page") ?? 1);
  const results = await listProducts({ q, page: Number.isFinite(page) ? page : 1, pageSize: 12 });
  return ok({ query: q, ...results });
});
