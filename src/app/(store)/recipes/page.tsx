import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { UtensilsCrossed } from "lucide-react";
import { db } from "@/db";
import { recipeIngredients, recipes } from "@/db/schema";
import { Badge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recipes with fresh ingredients",
  description:
    "Cook along with FreshCut recipes — palak paneer, aloo gobi masala, sprout chaat and gajar halwa — with one-tap ingredient baskets.",
};

export default async function RecipesPage() {
  const list = await db
    .select()
    .from(recipes)
    .where(eq(recipes.isActive, true))
    .orderBy(desc(recipes.createdAt));
  const ingredients = await db.select().from(recipeIngredients);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <nav aria-label="Breadcrumb" className="text-[11px] text-neutral-500">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span aria-hidden> / </span>
          <span className="text-brand-700">Recipes</span>
        </nav>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Recipe ideas</h1>
        <p className="text-sm text-neutral-600">
          Every recipe links to the exact FreshCut packs it needs, with quantities converted to our pack sizes.
        </p>
      </header>

      {list.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="h-7 w-7" />}
          title="No recipes published yet."
          description="Our kitchen team is writing the first batch of recipes."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((recipe) => {
            const count = ingredients.filter((i) => i.recipeId === recipe.id).length;
            return (
              <li key={recipe.id} className="card-surface overflow-hidden">
                <Link href={`/recipes/${recipe.slug}`} className="block">
                  <span className="relative block h-44 bg-brand-50">
                    {recipe.imageUrl ? (
                      <Image src={recipe.imageUrl} alt={recipe.name} fill sizes="420px" className="object-cover" />
                    ) : null}
                  </span>
                  <span className="block space-y-2 p-4">
                    <span className="flex items-center gap-2">
                      <Badge tone="brand">{recipe.difficulty.toLowerCase()}</Badge>
                      <Badge tone="neutral">{recipe.prepMinutes + recipe.cookMinutes} mins</Badge>
                    </span>
                    <span className="block text-base font-semibold text-ink">{recipe.name}</span>
                    <span className="block text-xs leading-relaxed text-neutral-600">{recipe.description}</span>
                    <span className="block text-[11px] text-brand-700">{count} ingredients • serves {recipe.servings}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
