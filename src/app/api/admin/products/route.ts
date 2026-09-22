import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { productVariants, products, stockItems } from "@/db/schema";
import { AppError, ok, parseBody, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { productInputSchema } from "@/lib/validation";
import { listProducts } from "@/server/catalog";
import { ensureVariantSku } from "@/server/products";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const result = await listProducts({
    q: url.searchParams.get("q"),
    categorySlug: url.searchParams.get("category"),
    page: Number(url.searchParams.get("page") ?? 1),
    pageSize: Number(url.searchParams.get("pageSize") ?? 20),
    includeInactive: true,
  });
  const all = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      isActive: products.isActive,
      isFeatured: products.isFeatured,
      productType: products.productType,
      categoryId: products.categoryId,
      shortDescription: products.shortDescription,
      description: products.description,
      images: products.images,
      tags: products.tags,
      aliases: products.aliases,
      preparationTypes: products.preparationTypes,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .where(
      url.searchParams.get("slug")
        ? eq(products.slug, url.searchParams.get("slug")!)
        : sql`true`,
    )
    .limit(300);
  return ok({ ...result, all });
});

export const POST = route(async (request) => {
  const admin = await requireAdmin();
  const body = await parseBody(request, productInputSchema);
  const slug = slugify(body.slug || body.name);
  if (!slug) throw new AppError("VALIDATION_ERROR", "Please provide a valid product name.");

  const existing = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1);
  if (existing[0]) throw new AppError("CONFLICT", "A product with this slug already exists.");

  const created = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(products)
      .values({
        name: body.name,
        slug,
        shortDescription: body.shortDescription || null,
        description: body.description || null,
        categoryId: body.categoryId ?? null,
        productType: body.productType,
        images: body.images.filter(Boolean),
        tags: body.tags.filter(Boolean),
        aliases: body.aliases.filter(Boolean).map((a) => a.toLowerCase()),
        preparationTypes: body.preparationTypes.filter(Boolean),
        isActive: body.isActive,
        isFeatured: body.isFeatured,
      })
      .returning();
    const product = rows[0]!;

    let defaultSet = false;
    for (const [index, variant] of body.variants.entries()) {
      const sku = await ensureVariantSku(slug, variant.label, tx);
      const isDefault = variant.isDefault && !defaultSet ? true : !defaultSet && index === 0;
      if (isDefault) defaultSet = true;
      const inserted = await tx
        .insert(productVariants)
        .values({
          productId: product.id,
          label: variant.label,
          sku,
          unit: variant.unit,
          weightInGrams: variant.weightInGrams ?? null,
          price: String(variant.price),
          mrp: variant.mrp != null ? String(variant.mrp) : null,
          stock: String(variant.stock),
          yieldRatio: variant.yieldRatio != null ? String(variant.yieldRatio) : null,
          isActive: variant.isActive,
          isDefault,
          sortOrder: index,
        })
        .returning();
      await tx.insert(stockItems).values({
        variantId: inserted[0]!.id,
        onHand: String(variant.stock),
        rawQty: String(variant.stock),
        lowStockThreshold: "5",
      });
    }
    return product;
  });

  await recordAudit({
    actorUserId: admin.id,
    actorLabel: admin.email,
    action: "PRODUCT_CREATED",
    resource: "product",
    resourceId: created.id,
    newValue: { name: created.name, slug: created.slug, variants: body.variants.length },
  });
  return ok({ product: created }, 201);
});
