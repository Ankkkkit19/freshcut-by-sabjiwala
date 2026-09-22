import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { Clock, Flame, Users } from "lucide-react";
import { db } from "@/db";
import { products, recipeIngredients, recipes } from "@/db/schema";
import { Badge, Card } from "@/components/ui";
import { AddRecipeBasket } from "@/components/recipe-basket";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const rows = await db.select().from(recipes).where(eq(recipes.slug, slug)).limit(1);
  const recipe = rows[0];
  if (!recipe) return { title: "Recipe not found" };
  return {
    title: `${recipe.name} recipe`,
    description: recipe.description ?? `${recipe.name} recipe with FreshCut ingredients.`,
    openGraph: { images: recipe.imageUrl ? [recipe.imageUrl] : undefined },
  };
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const rows = await db.select().from(recipes).where(eq(recipes.slug, slug)).limit(1);
  const recipe = rows[0];
  if (!recipe) notFound();

  const ingredients = await db
    .select({
      id: recipeIngredients.id,
      name: recipeIngredients.name,
      quantity: recipeIngredients.quantity,
      productId: recipeIngredients.productId,
      productSlug: products.slug,
      productName: products.name,
      images: products.images,
    })
    .from(recipeIngredients)
    .leftJoin(products, eq(products.id, recipeIngredients.productId))
    .where(eq(recipeIngredients.recipeId, recipe.id))
    .orderBy(asc(recipeIngredients.sortOrder));

  return (
    <article className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-[11px] text-neutral-500">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span aria-hidden> / </span>
        <Link href="/recipes" className="hover:underline">
          Recipes
        </Link>
        <span aria-hidden> / </span>
        <span className="text-brand-700">{recipe.name}</span>
      </nav>

      <header className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative h-56 overflow-hidden rounded-2xl border border-brand-100 bg-white sm:h-72">
          {recipe.imageUrl ? (
            <Image src={recipe.imageUrl} alt={recipe.name} fill priority sizes="(max-width:1024px) 100vw, 600px" className="object-cover" />
          ) : null}
        </div>
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">{recipe.name}</h1>
          <p className="text-sm leading-relaxed text-neutral-600">{recipe.description}</p>
          <ul className="flex flex-wrap gap-2 text-xs">
            <li>
              <Badge tone="brand">{recipe.difficulty.toLowerCase()}</Badge>
            </li>
            <li className="flex items-center gap-1 text-neutral-600">
              <Clock className="h-3.5 w-3.5" /> Prep {recipe.prepMinutes} min
            </li>
            <li className="flex items-center gap-1 text-neutral-600">
              <Flame className="h-3.5 w-3.5" /> Cook {recipe.cookMinutes} min
            </li>
            <li className="flex items-center gap-1 text-neutral-600">
              <Users className="h-3.5 w-3.5" /> Serves {recipe.servings}
            </li>
          </ul>
          <AddRecipeBasket
            recipeName={recipe.name}
            ingredients={ingredients
              .filter((i) => i.productId != null)
              .map((i) => ({
                productId: i.productId!,
                productName: i.productName ?? i.name,
                productSlug: i.productSlug ?? "",
              }))}
          />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="text-base font-semibold text-ink">Ingredients</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {ingredients.map((ingredient) => (
              <li key={ingredient.id} className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-2">
                <span className="text-neutral-700">
                  {ingredient.productSlug ? (
                    <Link href={`/products/${ingredient.productSlug}`} className="font-medium text-brand-700 hover:underline">
                      {ingredient.name}
                    </Link>
                  ) : (
                    ingredient.name
                  )}
                </span>
                <span className="text-xs text-neutral-500">{ingredient.quantity}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="text-base font-semibold text-ink">Method</h2>
          <ol className="mt-3 space-y-3 text-sm text-neutral-700">
            {recipe.instructions.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                  {index + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </article>
  );
}
