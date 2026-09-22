"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBasket } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { useCartUi } from "@/components/store";
import { Button, useToast } from "@/components/ui";

type Ingredient = { productId: number; productName: string; productSlug: string };

/**
 * Adds every linked recipe ingredient (default variant, one pack each) to the
 * server cart. Prices and packs always come from the API response.
 */
export function AddRecipeBasket({
  recipeName,
  ingredients,
}: {
  recipeName: string;
  ingredients: Ingredient[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const setCount = useCartUi((s) => s.setCount);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<string[]>([]);

  async function addBasket() {
    setLoading(true);
    const addedNames: string[] = [];
    const failures: string[] = [];
    try {
      for (const ingredient of ingredients) {
        try {
          const product = await apiFetch<{ variants: { id: number; stock: number; isActive: boolean }[] }>(
            `/api/products/${ingredient.productSlug}`,
          );
          const variant = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
          if (!variant) {
            failures.push(ingredient.productName);
            continue;
          }
          const result = await apiFetch<{ quote: { itemCount: number } }>("/api/cart", {
            method: "POST",
            json: { variantId: variant.id, quantity: 1 },
          });
          setCount(result.quote.itemCount);
          addedNames.push(ingredient.productName);
        } catch {
          failures.push(ingredient.productName);
        }
      }
      setAdded(addedNames);
      if (addedNames.length > 0) push(`${addedNames.length} ingredient(s) added for ${recipeName}`, "success");
      if (failures.length > 0) push(`Could not add: ${failures.join(", ")}`, "error");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (ingredients.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-brand-200 bg-white/70 px-3 py-2 text-xs text-neutral-500">
        No FreshCut products are linked to this recipe yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button loading={loading} onClick={addBasket}>
        <ShoppingBasket className="h-4 w-4" /> Add all {ingredients.length} ingredients
      </Button>
      {added.length > 0 ? (
        <p className="text-[11px] text-brand-700">
          Added: {added.join(", ")}. Adjust quantities in your cart.
        </p>
      ) : null}
    </div>
  );
}
