import { AppError, ok, route } from "@/lib/api";
import { getProductBySlug } from "@/server/catalog";

export const dynamic = "force-dynamic";

export const GET = route(async (_request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const product = await getProductBySlug(slug);
  if (!product) throw new AppError("NOT_FOUND", "That product could not be found.");
  return ok(product);
});
