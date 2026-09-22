import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, products, recipes } from "@/db/schema";

export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/products",
    "/vegetables",
    "/fruits",
    "/ready-to-cook",
    "/recipes",
    "/offers",
    "/login",
    "/signup",
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  try {
    const [productRows, categoryRows, recipeRows] = await Promise.all([
      db
        .select({ slug: products.slug, updatedAt: products.updatedAt })
        .from(products)
        .where(eq(products.isActive, true))
        .limit(500),
      db.select({ slug: categories.slug }).from(categories).where(eq(categories.isActive, true)),
      db.select({ slug: recipes.slug, updatedAt: recipes.updatedAt }).from(recipes).where(eq(recipes.isActive, true)),
    ]);

    return [
      ...staticRoutes,
      ...categoryRows.map((category) => ({
        url: `${BASE}/products?category=${category.slug}`,
        lastModified: new Date(),
        priority: 0.6,
      })),
      ...productRows.map((product) => ({
        url: `${BASE}/products/${product.slug}`,
        lastModified: product.updatedAt,
        priority: 0.8,
      })),
      ...recipeRows.map((recipe) => ({
        url: `${BASE}/recipes/${recipe.slug}`,
        lastModified: recipe.updatedAt,
        priority: 0.6,
      })),
    ];
  } catch {
    // Database unavailable during build - ship the static routes only.
    return staticRoutes;
  }
}
