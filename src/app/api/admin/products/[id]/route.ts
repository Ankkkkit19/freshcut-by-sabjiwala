import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, productVariants, products, stockItems } from "@/db/schema";
import { AppError, ok, parseBody, route } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { slugify, toNum } from "@/lib/utils";
import { productInputSchema } from "@/lib/validation";
import { adjustStock } from "@/server/inventory";
import { ensureVariantSku } from "@/server/products";

export const dynamic = "force-dynamic";

export const GET = route(async (_request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const rows = await db.select().from(products).where(eq(products.id, Number(id))).limit(1);
  const product = rows[0];
  if (!product) throw new AppError("NOT_FOUND", "Product not found.");
  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, product.id))
    .orderBy(productVariants.sortOrder);
  return ok({ product, variants });
});

export const PATCH = route(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const productId = Number(id);
  const body = await parseBody(request, productInputSchema.partial());
  const before = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!before[0]) throw new AppError("NOT_FOUND", "Product not found.");

  const stockChanges: { variantId: number; delta: number; label: string }[] = [];

  const updated = await db.transaction(async (tx) => {
    const rows = await tx
      .update(products)
      .set({
        ...(body.name ? { name: body.name } : {}),
        ...(body.slug ? { slug: slugify(body.slug) } : {}),
        ...(body.shortDescription !== undefined ? { shortDescription: body.shortDescription || null } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId ?? null } : {}),
        ...(body.productType ? { productType: body.productType } : {}),
        ...(body.images ? { images: body.images.filter(Boolean) } : {}),
        ...(body.tags ? { tags: body.tags.filter(Boolean) } : {}),
        ...(body.aliases
          ? { aliases: body.aliases.filter(Boolean).map((a) => a.toLowerCase()) }
          : {}),
        ...(body.preparationTypes ? { preparationTypes: body.preparationTypes.filter(Boolean) } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId))
      .returning();
    const product = rows[0]!;

    if (body.variants) {
      const existingVariants = await tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, productId));
      const keepIds = body.variants.filter((v) => v.id).map((v) => v.id!);
      const toRemove = existingVariants.filter((v) => !keepIds.includes(v.id));
      if (toRemove.length > 0) {
        const removable = await tx
          .select({ variantId: orderItems.variantId })
          .from(orderItems)
          .where(
            inArray(
              orderItems.variantId,
              toRemove.map((v) => v.id),
            ),
          )
          .limit(1);
        if (removable.length > 0) {
          throw new AppError(
            "CONFLICT",
            "A variant in this product is referenced by existing orders. Disable it instead of deleting.",
          );
        }
        await tx.delete(productVariants).where(
          inArray(
            productVariants.id,
            toRemove.map((v) => v.id),
          ),
        );
      }
      const slugForSku = slugify(body.slug || product.slug);
      let defaultSet = false;
      for (const [index, variant] of body.variants.entries()) {
        const isDefault = !defaultSet && (variant.isDefault || index === 0);
        if (isDefault) defaultSet = true;
        if (variant.id) {
          const current = existingVariants.find((v) => v.id === variant.id);
          if (!current) continue;
          const delta = toNum(variant.stock) - toNum(current.stock);
          await tx
            .update(productVariants)
            .set({
              label: variant.label,
              unit: variant.unit,
              weightInGrams: variant.weightInGrams ?? null,
              price: String(variant.price),
              mrp: variant.mrp != null ? String(variant.mrp) : null,
              stock: String(variant.stock),
              yieldRatio: variant.yieldRatio != null ? String(variant.yieldRatio) : null,
              isActive: variant.isActive,
              isDefault,
              sortOrder: index,
              updatedAt: new Date(),
            })
            .where(eq(productVariants.id, variant.id));
          if (delta !== 0) {
            stockChanges.push({ variantId: variant.id, delta, label: variant.label });
          }
        } else {
          const sku = await ensureVariantSku(slugForSku, variant.label, tx);
          const inserted = await tx
            .insert(productVariants)
            .values({
              productId,
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
          });
        }
      }
    }
    return product;
  });

  // Stock deltas recorded by the ledger so nothing changes silently.
  for (const change of stockChanges) {
    if (change.delta === 0) continue;
    await adjustStock({
      variantId: change.variantId,
      type: "ADJUSTMENT",
      quantity: change.delta,
      reason: `Manual stock set to new value via product editor (${change.label})`,
      actorUserId: admin.id,
      source: "ADMIN",
    });
    await recordAudit({
      actorUserId: admin.id,
      actorLabel: admin.email,
      action: "STOCK_UPDATED",
      resource: "product_variant",
      resourceId: change.variantId,
      newValue: { delta: change.delta },
    });
  }

  const auditAction =
    body.isActive === false ? "PRODUCT_DISABLED" : body.isActive === true ? "PRODUCT_ENABLED" : "PRODUCT_UPDATED";
  await recordAudit({
    actorUserId: admin.id,
    actorLabel: admin.email,
    action: auditAction,
    resource: "product",
    resourceId: productId,
    previousValue: { name: before[0].name, isActive: before[0].isActive },
    newValue: { name: updated.name, isActive: updated.isActive },
  });

  return ok({ product: updated, stockAdjusted: stockChanges.length });
});

export const DELETE = route(async (_request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const productId = Number(id);
  const before = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!before[0]) throw new AppError("NOT_FOUND", "Product not found.");

  const used = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM order_items oi
    JOIN product_variants v ON v.id = oi.variant_id
    WHERE v.product_id = ${productId}
  `);

  if (toNum(used.rows[0]?.count) > 0) {
    await db
      .update(products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(products.id, productId));
    await db
      .update(productVariants)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(productVariants.productId, productId));
    await recordAudit({
      actorUserId: admin.id,
      actorLabel: admin.email,
      action: "PRODUCT_DISABLED",
      resource: "product",
      resourceId: productId,
      previousValue: { isActive: before[0].isActive },
      newValue: { isActive: false, reason: "referenced by orders" },
    });
    return ok({ deleted: false, disabled: true });
  }

  await db.delete(products).where(eq(products.id, productId));
  await recordAudit({
    actorUserId: admin.id,
    actorLabel: admin.email,
    action: "PRODUCT_DELETED",
    resource: "product",
    resourceId: productId,
    previousValue: { name: before[0].name, slug: before[0].slug },
  });
  return ok({ deleted: true });
});
