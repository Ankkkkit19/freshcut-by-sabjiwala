
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { categories, products, productVariants } from "@/db/schema";
import { toNum } from "@/lib/utils";

export type ProductCard = {
  id: number;
  name: string;
  slug: string;
  shortDescription: string | null;
  images: string[];
  productType: string;
  tags: string[];
  isFeatured: boolean;
  categoryName: string | null;
  categorySlug: string | null;
  variants: {
    id: number;
    label: string;
    unit: string;
    price: number;
    mrp: number | null;
    stock: number;
    isDefault: boolean;
    isActive: boolean;
  }[];
  priceFrom: number;
  mrpFrom: number | null;
  inStock: boolean;
};

const variantShape = {
  id: productVariants.id,
  label: productVariants.label,
  unit: productVariants.unit,
  price: productVariants.price,
  mrp: productVariants.mrp,
  stock: productVariants.stock,
  isDefault: productVariants.isDefault,
  isActive: productVariants.isActive,
  sortOrder: productVariants.sortOrder,
};

type VariantRow = {
  id: number;
  label: string;
  unit: string;
  price: string;
  mrp: string | null;
  stock: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
};

function toCard(
  product: {
    id: number;
    name: string;
    slug: string;
    shortDescription: string | null;
    images: string[];
    productType: string;
    tags: string[];
    isFeatured: boolean;
    categoryName: string | null;
    categorySlug: string | null;
  },
  variants: VariantRow[],
): ProductCard {
  const active = variants.filter((v) => v.isActive);
  const usable = active.length > 0 ? active : variants;
  const prices = usable.map((v) => toNum(v.price));
  const mrps = usable.map((v) => (v.mrp ? toNum(v.mrp) : null)).filter((n): n is number => n != null);
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    images: product.images ?? [],
    productType: product.productType,
    tags: product.tags ?? [],
    isFeatured: product.isFeatured,
    categoryName: product.categoryName,
    categorySlug: product.categorySlug,
    variants: usable
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((v) => ({
        id: v.id,
        label: v.label,
        unit: v.unit,
        price: toNum(v.price),
        mrp: v.mrp ? toNum(v.mrp) : null,
        stock: toNum(v.stock),
        isDefault: v.isDefault,
        isActive: v.isActive,
      })),
    priceFrom: prices.length ? Math.min(...prices) : 0,
    mrpFrom: mrps.length ? Math.min(...mrps) : null,
    inStock: usable.some((v) => toNum(v.stock) > 0),
  };
}

async function attachVariants(
  rows: Omit<ProductCard, "variants" | "priceFrom" | "mrpFrom" | "inStock">[],
): Promise<ProductCard[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const variantRows = await db
    .select({ ...variantShape, productId: productVariants.productId })
    .from(productVariants)
    .where(inArray(productVariants.productId, ids))
    .orderBy(asc(productVariants.sortOrder));
  const byProduct = new Map<number, VariantRow[]>();
  for (const v of variantRows) {
    const list = byProduct.get(v.productId) ?? [];
    list.push(v);
    byProduct.set(v.productId, list);
  }
  return rows.map((row) => toCard(row, byProduct.get(row.id) ?? []));
}

const baseSelect = {
  id: products.id,
  name: products.name,
  slug: products.slug,
  shortDescription: products.shortDescription,
  images: products.images,
  productType: products.productType,
  tags: products.tags,
  isFeatured: products.isFeatured,
  categoryName: categories.name,
  categorySlug: categories.slug,
};

export type CatalogQuery = {
  categorySlug?: string | null;
  categoryId?: number | null;
  productType?: string | null;
  q?: string | null;
  featured?: boolean;
  readyToCook?: boolean;
  page?: number;
  pageSize?: number;
  sort?: "popular" | "price-asc" | "price-desc" | "newest";
  includeInactive?: boolean;
};

export function buildSearchCondition(term: string): SQL {
  const like = `%${term.trim()}%`;
  return or(
    ilike(products.name, like),
    ilike(products.shortDescription, like),
    ilike(categories.name, like),
    sql`${products.tags}::text ILIKE ${like}`,
    sql`${products.aliases}::text ILIKE ${like}`,
  )!;
}

export async function listProducts(query: CatalogQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(60, Math.max(4, query.pageSize ?? 12));
  const conditions: SQL[] = [];
  if (!query.includeInactive) conditions.push(eq(products.isActive, true));
  if (query.categorySlug) conditions.push(eq(categories.slug, query.categorySlug));
  if (query.categoryId) conditions.push(eq(products.categoryId, query.categoryId));
  if (query.productType) {
    conditions.push(sql`${products.productType}::text = ${query.productType}`);
  }
  if (query.readyToCook) {
    conditions.push(
      sql`(${products.productType}::text = 'READY_TO_COOK' OR ${products.productType}::text = 'SALAD')`,
    );
  }
  if (query.featured) conditions.push(eq(products.isFeatured, true));
  if (query.q && query.q.trim().length > 0) conditions.push(buildSearchCondition(query.q.trim()));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const orderBy =
    query.sort === "price-asc"
      ? asc(sql`(SELECT MIN(price) FROM product_variants v WHERE v.product_id = ${products.id})`)
      : query.sort === "price-desc"
        ? desc(sql`(SELECT MIN(price) FROM product_variants v WHERE v.product_id = ${products.id})`)
        : desc(products.createdAt);

  const rows = await db
    .select(baseSelect)
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(where)
    .orderBy(desc(products.isFeatured), orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(where);

  return {
    items: await attachVariants(rows),
    total: toNum(countRows[0]?.count),
    page,
    pageSize,
  };
}

export async function getProductBySlug(slug: string) {
  const rows = await db
    .select({ ...baseSelect, description: products.description, preparationTypes: products.preparationTypes, aliases: products.aliases, categoryId: products.categoryId })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.slug, slug))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const [card] = await attachVariants([row]);
  if (!card) return null;
  const related = await listProducts({
    categoryId: row.categoryId ?? undefined,
    pageSize: 5,
  });
  return {
    ...card,
    description: row.description,
    preparationTypes: row.preparationTypes ?? [],
    aliases: row.aliases ?? [],
    related: related.items.filter((p) => p.slug !== slug).slice(0, 4),
  };
}

export async function listCategories(includeInactive = false) {
  const conditions = includeInactive ? undefined : eq(categories.isActive, true);
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      imageUrl: categories.imageUrl,
      sortOrder: categories.sortOrder,
      isActive: categories.isActive,
      productCount: sql<number>`(
        SELECT COUNT(*)::int FROM products p
        WHERE p.category_id = ${categories.id} AND p.is_active = true
      )`,
    })
    .from(categories)
    .where(conditions)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return rows;
}

export async function searchSuggestions(term: string, limit = 6) {
  if (!term.trim()) return [];
  const rows = await db
    .select({
      name: products.name,
      slug: products.slug,
      image: sql<string | null>`(${products.images}->>0)`,
      category: categories.name,
      price: sql<string>`(SELECT MIN(price) FROM product_variants v WHERE v.product_id = ${products.id} AND v.is_active = true)`,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.isActive, true), buildSearchCondition(term.trim())))
    .limit(limit);
  return rows.map((r) => ({
    name: r.name,
    slug: r.slug,
    image: r.image,
    category: r.category,
    priceFrom: toNum(r.price),
  }));
}

/** WhatsApp / bot product resolver - matches name, alias, tags and category. */
export async function findProductByTerm(term: string) {
  const clean = term.trim();
  if (!clean) return null;
  const like = `%${clean}%`;
  const rows = await db
    .select({ ...baseSelect, aliases: products.aliases })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(
      and(
        eq(products.isActive, true),
        or(
          ilike(products.name, like),
          sql`${products.aliases}::text ILIKE ${like}`,
          sql`${products.tags}::text ILIKE ${like}`,
          ilike(categories.name, like),
        )!,
      ),
    )
    .limit(4);
  if (rows.length === 0) return null;
  const exact = rows.find((r) => r.name.toLowerCase() === clean.toLowerCase());
  const preferred =
    exact ??
    rows.find((r) => (r.aliases ?? []).some((a: string) => a.toLowerCase() === clean.toLowerCase())) ??
    rows[0]!;
  const [card] = await attachVariants([preferred]);
  return card ?? null;
}
