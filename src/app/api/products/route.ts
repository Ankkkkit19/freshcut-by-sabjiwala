import { ok, route } from "@/lib/api";
import { listProducts } from "@/server/catalog";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? 1);
  const pageSize = Number(url.searchParams.get("pageSize") ?? 12);
  const result = await listProducts({
    q: url.searchParams.get("q"),
    categorySlug: url.searchParams.get("category"),
    productType: url.searchParams.get("type"),
    readyToCook: url.searchParams.get("readyToCook") === "true",
    featured: url.searchParams.get("featured") === "true",
    sort: (url.searchParams.get("sort") as "popular" | "price-asc" | "price-desc" | "newest") ?? "popular",
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 12,
  });
  return ok(result);
});
