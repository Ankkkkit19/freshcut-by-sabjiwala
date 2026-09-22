
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { productVariants } from "@/db/schema";
import { slugify } from "@/lib/utils";
import type { Tx } from "@/server/inventory";

/** SKUs must be unique - collisions get a numeric suffix. */
export async function ensureVariantSku(
  productSlug: string,
  label: string,
  client: Tx | typeof db = db,
): Promise<string> {
  const base = `${slugify(productSlug)}-${slugify(label)}`.slice(0, 50) || `variant-${Date.now()}`;
  let candidate = base;
  for (let attempt = 2; attempt < 50; attempt += 1) {
    const rows = await client
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.sku, candidate))
      .limit(1);
    if (!rows[0]) return candidate;
    candidate = `${base}-${attempt}`;
  }
  return `${base}-${Date.now()}`;
}
