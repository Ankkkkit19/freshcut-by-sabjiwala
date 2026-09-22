
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  coupons,
  deliveryZones,
  offers,
  recipeIngredients,
  recipes,
} from "@/db/schema";
import { AppError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { slugify, toNum } from "@/lib/utils";
import {
  categoryInputSchema,
  couponInputSchema,
  offerInputSchema,
  recipeInputSchema,
  zoneInputSchema,
} from "@/lib/validation";

export const RESOURCES = ["categories", "coupons", "offers", "recipes", "zones"] as const;
export type ResourceKey = (typeof RESOURCES)[number];

export function isResource(value: string): value is ResourceKey {
  return (RESOURCES as readonly string[]).includes(value);
}

type Actor = { id: number | null; label: string };

const prettify = (v: unknown) => (v == null ? null : JSON.parse(JSON.stringify(v)));

export async function listResource(resource: ResourceKey) {
  switch (resource) {
    case "categories":
      return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
    case "coupons":
      return db.select().from(coupons).orderBy(desc(coupons.createdAt));
    case "offers":
      return db.select().from(offers).orderBy(asc(offers.sortOrder), desc(offers.createdAt));
    case "recipes": {
      const rows = await db.select().from(recipes).orderBy(desc(recipes.createdAt));
      const ingredients = await db.select().from(recipeIngredients).orderBy(asc(recipeIngredients.id));
      return rows.map((r) => ({
        ...r,
        ingredients: ingredients.filter((i) => i.recipeId === r.id),
      }));
    }
    case "zones":
      return db
        .select()
        .from(deliveryZones)
        .orderBy(asc(deliveryZones.pincode), asc(deliveryZones.area));
    default:
      throw new AppError("NOT_FOUND", "Unknown admin resource.");
  }
}

export async function createResource(resource: ResourceKey, body: unknown, actor: Actor) {
  switch (resource) {
    case "categories": {
      const data = categoryInputSchema.parse(body);
      const slug = slugify(data.slug || data.name);
      const exists = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug));
      if (exists[0]) throw new AppError("CONFLICT", "A category with this slug already exists.");
      const rows = await db
        .insert(categories)
        .values({
          name: data.name,
          slug,
          description: data.description || null,
          imageUrl: data.imageUrl || null,
          sortOrder: data.sortOrder,
          isActive: data.isActive,
        })
        .returning();
      await recordAudit({
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "CATEGORY_CREATED",
        resource: "category",
        resourceId: rows[0]!.id,
        newValue: prettify(rows[0]),
      });
      return rows[0]!;
    }
    case "coupons": {
      const data = couponInputSchema.parse(body);
      const code = data.code.toUpperCase();
      const exists = await db.select({ id: coupons.id }).from(coupons).where(sql`upper(${coupons.code}) = ${code}`);
      if (exists[0]) throw new AppError("CONFLICT", "A coupon with this code already exists.");
      const rows = await db
        .insert(coupons)
        .values({
          code,
          description: data.description || null,
          type: data.type,
          value: String(data.value),
          minOrderValue: String(data.minOrderValue),
          maxDiscount: data.maxDiscount != null ? String(data.maxDiscount) : null,
          startsAt: data.startsAt ? new Date(data.startsAt) : new Date(),
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          usageLimit: data.usageLimit ?? null,
          perUserLimit: data.perUserLimit,
          applicableCategoryIds: data.applicableCategoryIds,
          applicableProductIds: data.applicableProductIds,
          isActive: data.isActive,
        })
        .returning();
      await recordAudit({
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "COUPON_CREATED",
        resource: "coupon",
        resourceId: code,
        newValue: prettify(rows[0]),
      });
      return rows[0]!;
    }
    case "offers": {
      const data = offerInputSchema.parse(body);
      const rows = await db
        .insert(offers)
        .values({
          title: data.title,
          subtitle: data.subtitle || null,
          description: data.description || null,
          imageUrl: data.imageUrl || null,
          badge: data.badge || null,
          discountText: data.discountText || null,
          code: data.code ? data.code.toUpperCase() : null,
          ctaHref: data.ctaHref || null,
          startsAt: data.startsAt ? new Date(data.startsAt) : new Date(),
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          isActive: data.isActive,
          sortOrder: data.sortOrder,
        })
        .returning();
      await recordAudit({
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "OFFER_CREATED",
        resource: "offer",
        resourceId: rows[0]!.id,
        newValue: prettify(rows[0]),
      });
      return rows[0]!;
    }
    case "recipes": {
      const data = recipeInputSchema.parse(body);
      const slug = slugify(data.slug || data.name);
      const rows = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(recipes)
          .values({
            name: data.name,
            slug,
            description: data.description || null,
            imageUrl: data.imageUrl || null,
            prepMinutes: data.prepMinutes,
            cookMinutes: data.cookMinutes,
            servings: data.servings,
            difficulty: data.difficulty,
            instructions: data.instructions,
            isActive: data.isActive,
          })
          .returning();
        const recipe = inserted[0]!;
        if (data.ingredients.length > 0) {
          await tx.insert(recipeIngredients).values(
            data.ingredients.map((ing, index) => ({
              recipeId: recipe.id,
              name: ing.name,
              quantity: ing.quantity,
              productId: ing.productId ?? null,
              sortOrder: index,
            })),
          );
        }
        return recipe;
      });
      await recordAudit({
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "RECIPE_CREATED",
        resource: "recipe",
        resourceId: rows.id,
        newValue: prettify(rows),
      });
      return rows;
    }
    case "zones": {
      const data = zoneInputSchema.parse(body);
      const exists = await db
        .select({ id: deliveryZones.id })
        .from(deliveryZones)
        .where(eq(deliveryZones.pincode, data.pincode));
      const duplicate = exists.length > 0 ? await db
        .select({ id: deliveryZones.id })
        .from(deliveryZones)
        .where(sql`${deliveryZones.pincode} = ${data.pincode} AND lower(${deliveryZones.area}) = ${data.area.toLowerCase()}`) : [];
      if (duplicate[0]) throw new AppError("CONFLICT", "This pincode + area zone already exists.");
      const rows = await db
        .insert(deliveryZones)
        .values({
          pincode: data.pincode,
          area: data.area,
          city: data.city,
          state: data.state,
          deliveryFee: String(data.deliveryFee),
          minOrderValue: String(data.minOrderValue),
          freeDeliveryThreshold: String(data.freeDeliveryThreshold),
          etaMinutes: data.etaMinutes,
          isActive: data.isActive,
        })
        .returning();
      await recordAudit({
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "DELIVERY_ZONE_CREATED",
        resource: "delivery_zone",
        resourceId: rows[0]!.id,
        newValue: prettify(rows[0]),
      });
      return rows[0]!;
    }
    default:
      throw new AppError("NOT_FOUND", "Unknown admin resource.");
  }
}

export async function updateResource(
  resource: ResourceKey,
  id: number,
  body: unknown,
  actor: Actor,
) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) throw new AppError("BAD_REQUEST", "Invalid id.");

  switch (resource) {
    case "categories": {
      const data = categoryInputSchema.partial().parse(body);
      const before = await db.select().from(categories).where(eq(categories.id, numericId)).limit(1);
      if (!before[0]) throw new AppError("NOT_FOUND", "Category not found.");
      const rows = await db
        .update(categories)
        .set({
          ...(data.name ? { name: data.name } : {}),
          ...(data.slug ? { slug: slugify(data.slug) } : {}),
          ...(data.description !== undefined ? { description: data.description || null } : {}),
          ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl || null } : {}),
          ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          updatedAt: new Date(),
        })
        .where(eq(categories.id, numericId))
        .returning();
      await recordAudit({
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: data.isActive === false ? "CATEGORY_DISABLED" : "CATEGORY_UPDATED",
        resource: "category",
        resourceId: numericId,
        previousValue: prettify(before[0]),
        newValue: prettify(rows[0]),
      });
      return rows[0]!;
    }
    case "coupons": {
      const data = couponInputSchema.partial().parse(body);
      const before = await db.select().from(coupons).where(eq(coupons.id, numericId)).limit(1);
      if (!before[0]) throw new AppError("NOT_FOUND", "Coupon not found.");
      const rows = await db
        .update(coupons)
        .set({
          ...(data.code ? { code: data.code.toUpperCase() } : {}),
          ...(data.description !== undefined ? { description: data.description || null } : {}),
          ...(data.type ? { type: data.type } : {}),
          ...(data.value !== undefined ? { value: String(data.value) } : {}),
          ...(data.minOrderValue !== undefined ? { minOrderValue: String(data.minOrderValue) } : {}),
          ...(data.maxDiscount !== undefined
            ? { maxDiscount: data.maxDiscount != null ? String(data.maxDiscount) : null }
            : {}),
          ...(data.startsAt ? { startsAt: new Date(data.startsAt) } : {}),
          ...(data.expiresAt !== undefined
            ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }
            : {}),
          ...(data.usageLimit !== undefined ? { usageLimit: data.usageLimit ?? null } : {}),
          ...(data.perUserLimit !== undefined ? { perUserLimit: data.perUserLimit } : {}),
          ...(data.applicableCategoryIds ? { applicableCategoryIds: data.applicableCategoryIds } : {}),
          ...(data.applicableProductIds ? { applicableProductIds: data.applicableProductIds } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          updatedAt: new Date(),
        })
        .where(eq(coupons.id, numericId))
        .returning();
      await recordAudit({
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: data.isActive === false ? "COUPON_DISABLED" : "COUPON_UPDATED",
        resource: "coupon",
        resourceId: rows[0]!.code,
        previousValue: prettify(before[0]),
        newValue: prettify(rows[0]),
      });
      return rows[0]!;
    }
    case "offers": {
      const data = offerInputSchema.partial().parse(body);
      const before = await db.select().from(offers).where(eq(offers.id, numericId)).limit(1);
      if (!before[0]) throw new AppError("NOT_FOUND", "Offer not found.");
      const rows = await db
        .update(offers)
        .set({
          ...(data.title ? { title: data.title } : {}),
          ...(data.subtitle !== undefined ? { subtitle: data.subtitle || null } : {}),
          ...(data.description !== undefined ? { description: data.description || null } : {}),
          ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl || null } : {}),
          ...(data.badge !== undefined ? { badge: data.badge || null } : {}),
          ...(data.discountText !== undefined ? { discountText: data.discountText || null } : {}),
          ...(data.code !== undefined ? { code: data.code ? data.code.toUpperCase() : null } : {}),
          ...(data.ctaHref !== undefined ? { ctaHref: data.ctaHref || null } : {}),
          ...(data.startsAt ? { startsAt: new Date(data.startsAt) } : {}),
          ...(data.expiresAt !== undefined
            ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }
            : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
          updatedAt: new Date(),
        })
        .where(eq(offers.id, numericId))
        .returning();
      await recordAudit({
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: data.isActive === false ? "OFFER_DISABLED" : "OFFER_UPDATED",
        resource: "offer",
        resourceId: numericId,
        previousValue: prettify(before[0]),
        newValue: prettify(rows[0]),
      });
      return rows[0]!;
    }
    case "recipes": {
      const data = recipeInputSchema.partial().parse(body);
      const before = await db.select().from(recipes).where(eq(recipes.id, numericId)).limit(1);
      if (!before[0]) throw new AppError("NOT_FOUND", "Recipe not found.");
      const updated = await db.transaction(async (tx) => {
        const rows = await tx
          .update(recipes)
          .set({
            ...(data.name ? { name: data.name } : {}),
            ...(data.slug ? { slug: slugify(data.slug) } : {}),
            ...(data.description !== undefined ? { description: data.description || null } : {}),
            ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl || null } : {}),
            ...(data.prepMinutes !== undefined ? { prepMinutes: data.prepMinutes } : {}),
            ...(data.cookMinutes !== undefined ? { cookMinutes: data.cookMinutes } : {}),
            ...(data.servings !== undefined ? { servings: data.servings } : {}),
            ...(data.difficulty ? { difficulty: data.difficulty } : {}),
            ...(data.instructions !== undefined ? { instructions: data.instructions } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            updatedAt: new Date(),
          })
          .where(eq(recipes.id, numericId))
          .returning();
        if (data.ingredients) {
          await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, numericId));
          if (data.ingredients.length > 0) {
            await tx.insert(recipeIngredients).values(
              data.ingredients.map((ing, index) => ({
                recipeId: numericId,
                name: ing.name,
                quantity: ing.quantity,
                productId: ing.productId ?? null,
                sortOrder: index,
              })),
            );
          }
        }
        return rows[0]!;
      });
      await recordAudit({
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "RECIPE_UPDATED",
        resource: "recipe",
        resourceId: numericId,
        previousValue: prettify(before[0]),
        newValue: prettify(updated),
      });
      return updated;
    }
    case "zones": {
      const data = zoneInputSchema.partial().parse(body);
      const before = await db.select().from(deliveryZones).where(eq(deliveryZones.id, numericId)).limit(1);
      if (!before[0]) throw new AppError("NOT_FOUND", "Delivery zone not found.");
      const rows = await db
        .update(deliveryZones)
        .set({
          ...(data.pincode ? { pincode: data.pincode } : {}),
          ...(data.area ? { area: data.area } : {}),
          ...(data.city ? { city: data.city } : {}),
          ...(data.state ? { state: data.state } : {}),
          ...(data.deliveryFee !== undefined ? { deliveryFee: String(data.deliveryFee) } : {}),
          ...(data.minOrderValue !== undefined ? { minOrderValue: String(data.minOrderValue) } : {}),
          ...(data.freeDeliveryThreshold !== undefined
            ? { freeDeliveryThreshold: String(data.freeDeliveryThreshold) }
            : {}),
          ...(data.etaMinutes !== undefined ? { etaMinutes: data.etaMinutes } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          updatedAt: new Date(),
        })
        .where(eq(deliveryZones.id, numericId))
        .returning();
      await recordAudit({
        actorUserId: actor.id,
        actorLabel: actor.label,
        action: "DELIVERY_ZONE_UPDATED",
        resource: "delivery_zone",
        resourceId: numericId,
        previousValue: prettify(before[0]),
        newValue: prettify(rows[0]),
      });
      return rows[0]!;
    }
    default:
      throw new AppError("NOT_FOUND", "Unknown admin resource.");
  }
}

export async function deleteResource(resource: ResourceKey, id: number, actor: Actor) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) throw new AppError("BAD_REQUEST", "Invalid id.");
  let label = "";
  switch (resource) {
    case "categories": {
      const before = await db.select().from(categories).where(eq(categories.id, numericId)).limit(1);
      if (!before[0]) throw new AppError("NOT_FOUND", "Category not found.");
      const used = await db.execute<{ count: number }>(
        sql`SELECT COUNT(*)::int AS count FROM products WHERE category_id = ${numericId}`,
      );
      if (toNum(used.rows[0]?.count) > 0) {
        throw new AppError(
          "CONFLICT",
          "This category still has products. Move or delete them first.",
        );
      }
      await db.delete(categories).where(eq(categories.id, numericId));
      label = before[0].name;
      break;
    }
    case "coupons": {
      const before = await db.select().from(coupons).where(eq(coupons.id, numericId)).limit(1);
      if (!before[0]) throw new AppError("NOT_FOUND", "Coupon not found.");
      await db.delete(coupons).where(eq(coupons.id, numericId));
      label = before[0].code;
      break;
    }
    case "offers": {
      const before = await db.select().from(offers).where(eq(offers.id, numericId)).limit(1);
      if (!before[0]) throw new AppError("NOT_FOUND", "Offer not found.");
      await db.delete(offers).where(eq(offers.id, numericId));
      label = before[0].title;
      break;
    }
    case "recipes": {
      const before = await db.select().from(recipes).where(eq(recipes.id, numericId)).limit(1);
      if (!before[0]) throw new AppError("NOT_FOUND", "Recipe not found.");
      await db.delete(recipes).where(eq(recipes.id, numericId));
      label = before[0].name;
      break;
    }
    case "zones": {
      const before = await db.select().from(deliveryZones).where(eq(deliveryZones.id, numericId)).limit(1);
      if (!before[0]) throw new AppError("NOT_FOUND", "Delivery zone not found.");
      await db.delete(deliveryZones).where(eq(deliveryZones.id, numericId));
      label = `${before[0].area} ${before[0].pincode}`;
      break;
    }
    default:
      throw new AppError("NOT_FOUND", "Unknown admin resource.");
  }
  await recordAudit({
    actorUserId: actor.id,
    actorLabel: actor.label,
    action: `${resource.slice(0, -1).toUpperCase()}_DELETED`,
    resource: resource.slice(0, -1),
    resourceId: numericId,
    previousValue: { label },
  });
  return { deleted: true };
}

export async function getResourceCounts() {
  const rows = await db.execute<{
    categories: number;
    coupons: number;
    offers: number;
    recipes: number;
    zones: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM categories) AS categories,
      (SELECT COUNT(*)::int FROM coupons) AS coupons,
      (SELECT COUNT(*)::int FROM offers) AS offers,
      (SELECT COUNT(*)::int FROM recipes) AS recipes,
      (SELECT COUNT(*)::int FROM delivery_zones) AS zones
  `);
  return rows.rows[0];
}
