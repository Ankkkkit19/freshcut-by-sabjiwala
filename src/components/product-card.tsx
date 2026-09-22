"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBasket } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { cn, discountPercent } from "@/lib/utils";
import { useCartUi } from "@/components/store";
import { Badge, Button, useToast } from "@/components/ui";

export type ProductCardData = {
  id: number;
  name: string;
  slug: string;
  shortDescription: string | null;
  images: string[];
  categoryName: string | null;
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
  tags: string[];
};

export function ProductCard({ product, compact }: { product: ProductCardData; compact?: boolean }) {
  const activeVariants = product.variants.filter((v) => v.isActive);
  const initial =
    activeVariants.find((v) => v.isDefault && v.stock > 0) ??
    activeVariants.find((v) => v.stock > 0) ??
    activeVariants[0];
  const [variantId, setVariantId] = useState<number | undefined>(initial?.id);
  const selected = activeVariants.find((v) => v.id === variantId) ?? initial;
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const { push } = useToast();
  const setCount = useCartUi((s) => s.setCount);
  const setLastAdded = useCartUi((s) => s.setLastAdded);

  const off = selected ? discountPercent(selected.price, selected.mrp) : null;
  const image = product.images[0];

  async function addToCart() {
    if (!selected) return;
    setLoading(true);
    try {
      // Optimistic quantity feedback only - server returns the authoritative cart.
      const result = await apiFetch<{ quantity: number; quote: { itemCount: number } }>("/api/cart", {
        method: "POST",
        json: { variantId: selected.id, quantity },
      });
      setCount(result.quote.itemCount);
      setLastAdded(`${product.name} ${selected.label}`);
      push(`${product.name} ${selected.label} added to cart`, "success");
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not add to cart", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article
      className={cn(
        "card-surface group flex h-full flex-col overflow-hidden transition hover:border-brand-300 hover:shadow-sm",
        compact && "text-sm",
      )}
    >
      <Link href={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden bg-brand-50">
        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 220px"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-brand-300">
            <ShoppingBasket className="h-10 w-10" />
          </div>
        )}
        {off ? (
          <span className="absolute left-2 top-2 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">
            {off}% OFF
          </span>
        ) : null}
        {selected && selected.stock <= 0 ? (
          <span className="absolute right-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-semibold text-white">
            Out of stock
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {product.categoryName ? (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-600">
            {product.categoryName}
          </p>
        ) : null}
        <Link href={`/products/${product.slug}`} className="line-clamp-2 text-sm font-semibold text-ink hover:text-brand-700">
          {product.name}
        </Link>
        {!compact && product.shortDescription ? (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-neutral-500">{product.shortDescription}</p>
        ) : null}

        {activeVariants.length > 1 ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Choose ${product.name} pack size`}>
            {activeVariants.slice(0, 4).map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => setVariantId(variant.id)}
                aria-pressed={variant.id === selected?.id}
                className={cn(
                  "rounded-lg border px-2 py-1 text-[11px] font-medium transition",
                  variant.id === selected?.id
                    ? "border-brand-500 bg-brand-50 text-brand-800"
                    : "border-neutral-200 text-neutral-600 hover:border-brand-300",
                  variant.stock <= 0 && "opacity-50",
                )}
              >
                {variant.label}
              </button>
            ))}
          </div>
        ) : selected ? (
          <p className="text-[11px] text-neutral-500">{selected.label}</p>
        ) : null}

        <div className="mt-auto space-y-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-base font-semibold text-ink">
                ₹{selected ? selected.price.toFixed(0) : "—"}
                <span className="ml-1 text-[11px] font-normal text-neutral-500">
                  /{selected?.unit.toLowerCase() ?? "unit"}
                </span>
              </p>
              {selected?.mrp && selected.mrp > selected.price ? (
                <p className="text-[11px] text-neutral-400 line-through">₹{selected.mrp.toFixed(0)}</p>
              ) : null}
            </div>
            {selected ? (
              <Badge tone={selected.stock > 0 ? "success" : "danger"}>
                {selected.stock > 0 ? "In stock" : "Out"}
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full border border-brand-200 bg-white">
              <button
                type="button"
                aria-label={`Decrease ${product.name} quantity`}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="grid h-8 w-8 place-items-center rounded-full text-brand-700 hover:bg-brand-50"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span aria-live="polite" className="w-6 text-center text-sm font-semibold">
                {quantity}
              </span>
              <button
                type="button"
                aria-label={`Increase ${product.name} quantity`}
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                className="grid h-8 w-8 place-items-center rounded-full text-brand-700 hover:bg-brand-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button
              size="sm"
              className="flex-1"
              loading={loading}
              disabled={!selected || selected.stock <= 0}
              onClick={addToCart}
            >
              {selected && selected.stock <= 0 ? "Out of stock" : "Add"}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="card-surface overflow-hidden">
      <div className="aspect-square animate-pulse bg-brand-50" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-16 animate-pulse rounded bg-brand-50" />
        <div className="h-4 w-32 animate-pulse rounded bg-brand-50" />
        <div className="h-3 w-24 animate-pulse rounded bg-brand-50" />
        <div className="h-9 w-full animate-pulse rounded-full bg-brand-50" />
      </div>
    </div>
  );
}

export function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{children}</div>
  );
}
