"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Clock, Minus, Plus, ShieldCheck, Truck } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { cn, discountPercent } from "@/lib/utils";
import { useCartUi } from "@/components/store";
import { Alert, Badge, Button, useToast } from "@/components/ui";

export type BuyBoxVariant = {
  id: number;
  label: string;
  unit: string;
  price: number;
  mrp: number | null;
  stock: number;
  isDefault: boolean;
  isActive: boolean;
  yieldRatio?: number | null;
};

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const usable = images.length > 0 ? images : ["/images/hero-basket.jpg"];
  const [active, setActive] = useState(0);
  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-brand-100 bg-white">
        <Image
          src={usable[active] ?? usable[0]!}
          alt={`${name} — image ${active + 1} of ${usable.length}`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 520px"
          className="object-cover"
        />
      </div>
      {usable.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto no-scrollbar" aria-label={`${name} images`}>
          {usable.map((image, index) => (
            <li key={image}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Show image ${index + 1}`}
                aria-current={index === active}
                className={cn(
                  "relative h-16 w-16 overflow-hidden rounded-xl border",
                  index === active ? "border-brand-500" : "border-brand-100",
                )}
              >
                <Image src={image} alt="" fill sizes="64px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ProductBuyBox({
  product,
  preparationTypes,
  freeDeliveryThreshold,
  minOrderValue,
  etaMinutes,
}: {
  product: {
    id: number;
    name: string;
    slug: string;
    shortDescription: string | null;
    variants: BuyBoxVariant[];
  };
  preparationTypes: string[];
  freeDeliveryThreshold: number;
  minOrderValue: number;
  etaMinutes: number;
}) {
  const router = useRouter();
  const { push } = useToast();
  const setCount = useCartUi((s) => s.setCount);
  const activeVariants = product.variants.filter((v) => v.isActive);
  const initial =
    activeVariants.find((v) => v.isDefault && v.stock > 0) ??
    activeVariants.find((v) => v.stock > 0) ??
    activeVariants[0];
  const [variantId, setVariantId] = useState<number | undefined>(initial?.id);
  const [preparation, setPreparation] = useState<string>(preparationTypes[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState<"cart" | "buy" | null>(null);

  const selected = activeVariants.find((v) => v.id === variantId) ?? initial;
  const off = selected ? discountPercent(selected.price, selected.mrp) : null;
  const max = selected ? Math.max(1, Math.floor(selected.stock)) : 1;

  async function addToCart(mode: "cart" | "buy") {
    if (!selected) return;
    setLoading(mode);
    try {
      const result = await apiFetch<{ quote: { itemCount: number; subtotal: number } }>("/api/cart", {
        method: "POST",
        json: { variantId: selected.id, quantity, preparation: preparation || undefined },
      });
      setCount(result.quote.itemCount);
      push(`${product.name} ${selected.label} added`, "success");
      if (mode === "buy") {
        router.push("/checkout");
      } else {
        router.refresh();
      }
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not add to cart", "error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{product.name}</h1>
        {product.shortDescription ? (
          <p className="mt-1 text-sm text-neutral-600">{product.shortDescription}</p>
        ) : null}
      </div>

      {selected ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-3xl font-semibold text-ink">
            ₹{selected.price.toFixed(0)}
            <span className="ml-1 text-sm font-normal text-neutral-500">
              / {selected.label}
            </span>
          </p>
          {selected.mrp && selected.mrp > selected.price ? (
            <>
              <p className="text-sm text-neutral-400 line-through">₹{selected.mrp.toFixed(0)}</p>
              <Badge tone="success">Save {off}%</Badge>
            </>
          ) : null}
          <Badge tone={selected.stock > 0 ? "success" : "danger"}>
            {selected.stock > 0 ? `In stock · ${selected.stock} left` : "Out of stock"}
          </Badge>
        </div>
      ) : (
        <Alert tone="warn">This product has no active pack sizes right now.</Alert>
      )}

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-brand-800">
          Select pack size
        </legend>
        <div className="flex flex-wrap gap-2">
          {activeVariants.map((variant) => {
            const isSelected = variant.id === selected?.id;
            return (
              <button
                key={variant.id}
                type="button"
                aria-pressed={isSelected}
                disabled={variant.stock <= 0}
                onClick={() => setVariantId(variant.id)}
                className={cn(
                  "min-w-28 rounded-xl border px-3 py-2 text-left text-sm transition",
                  isSelected ? "border-brand-500 bg-brand-50" : "border-neutral-200 bg-white hover:border-brand-300",
                  variant.stock <= 0 && "cursor-not-allowed opacity-50",
                )}
              >
                <span className="block font-semibold text-ink">{variant.label}</span>
                <span className="block text-[11px] text-neutral-500">
                  ₹{variant.price.toFixed(0)}
                  {variant.mrp && variant.mrp > variant.price ? (
                    <span className="ml-1 line-through">₹{variant.mrp.toFixed(0)}</span>
                  ) : null}
                </span>
                <span className="block text-[10px] text-neutral-400">
                  {variant.stock > 0 ? `${variant.stock} in stock` : "Out of stock"}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {preparationTypes.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wide text-brand-800">
            Preparation
          </legend>
          <div className="flex flex-wrap gap-2">
            {preparationTypes.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={preparation === option}
                onClick={() => setPreparation(option)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium capitalize",
                  preparation === option
                    ? "border-brand-500 bg-brand-50 text-brand-800"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-brand-300",
                )}
              >
                {option.toLowerCase()}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-500">
            Cut to order in our kitchen — priced per pack, prepared the same morning.
          </p>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border border-brand-200 bg-white">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="grid h-10 w-10 place-items-center rounded-full text-brand-700 hover:bg-brand-50"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span aria-live="polite" className="w-8 text-center text-sm font-semibold">
            {quantity}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((q) => Math.min(20, q + 1))}
            className="grid h-10 w-10 place-items-center rounded-full text-brand-700 hover:bg-brand-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {selected ? (
          <Button
            size="lg"
            loading={loading === "cart"}
            disabled={!selected || selected.stock <= 0}
            onClick={() => addToCart("cart")}
            className="min-w-40 flex-1 sm:flex-none"
          >
            Add to Cart
          </Button>
        ) : null}
        <Button
          size="lg"
          variant="secondary"
          loading={loading === "buy"}
          disabled={!selected || selected.stock <= 0}
          onClick={() => addToCart("buy")}
          className="min-w-40 flex-1 sm:flex-none"
        >
          Buy Now
        </Button>
      </div>

      {selected && quantity > max ? (
        <Alert tone="warn">Only {max} packs available right now.</Alert>
      ) : null}

      <ul className="grid gap-2 rounded-2xl bg-brand-50/70 p-3 text-xs text-brand-900 sm:grid-cols-2">
        <li className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-brand-600" /> Delivered in ~{etaMinutes} minutes
        </li>
        <li className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-brand-600" /> Free delivery above ₹{freeDeliveryThreshold}
        </li>
        <li className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-600" /> Minimum order ₹{minOrderValue}
        </li>
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 text-brand-600" /> Cut fresh the same morning
        </li>
      </ul>
    </div>
  );
}
