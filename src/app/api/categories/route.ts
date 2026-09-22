import { ok, route } from "@/lib/api";
import { listCategories } from "@/server/catalog";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const categories = await listCategories();
  return ok({ categories });
});
