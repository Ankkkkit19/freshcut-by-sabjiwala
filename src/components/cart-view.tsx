"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Minus, Plus, ShoppingBasket, Tag, Trash2 } from "lucide-react";
import { apiFetch, money } from "@/lib/client";
import type { Quote } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCartUi } from "@/components/store";
import { Alert, Badge, Button, Card, EmptyState, Input, useToast } from "@/components/ui";

export function CartView({
  initialQuote,
  addressId,
  isSignedIn,
}: {
  initialQuote: Quote;
  addressId: number | null;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [quote, setQuote] = useState(initialQuote);
  const [coupon, setCoupon] = useState(initialQuote.coupon?.code ?? "");
  const [busy, setBusy] = useState<number | "coupon" | "clear" | null>(null);
  const setCount = useCartUi((s) => s.setCount);
  const markPending = useCartUi((s) => s.markPending);

  useEffect(() => {
    setCount(quote.itemCount);
  }, [quote.itemCount, setCount]);

  function applyQuote(next: Quote) {
    setQuote(next);
    setCount(next.itemCount);
  }

  async function refresh(couponCode?: string) {
    const params = new URLSearchParams();
    if (addressId) params.set("addressId", String(addressId));
    if (couponCode) params.set("coupon", couponCode);
    const data = await apiFetch<{ quote: Quote }>(`/api/cart?${params.toString()}`);
    applyQuote(data.quote);
    return data.quote;
  }

  async function updateQuantity(lineId: number, quantity: number) {
    setBusy(lineId);
    markPending(lineId, true);
    try {
      const data = await apiFetch<{ quote: Quote }>("/api/cart", {
        method: "PATCH",
        json: { itemId: lineId, quantity },
      });
      applyQuote(data.quote);
      router.refresh();
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not update quantity", "error");
      await refresh(coupon).catch(() => undefined);
    } finally {
      markPending(lineId, false);
      setBusy(null);
    }
  }

  async function removeLine(lineId: number) {
    setBusy(lineId);
    try {
      const data = await apiFetch<{ quote: Quote }>(`/api/cart?itemId=${lineId}`, { method: "DELETE" });
      applyQuote(data.quote);
      push("Item removed from cart", "info");
      router.refresh();
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not remove item", "error");
    } finally {
      setBusy(null);
    }
  }

  async function clearAll() {
    setBusy("clear");
    try {
      const data = await apiFetch<{ quote: Quote }>("/api/cart", { method: "DELETE" });
      applyQuote(data.quote);
      setCoupon("");
      router.refresh();
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not clear cart", "error");
    } finally {
      setBusy(null);
    }
  }

  async function applyCoupon() {
    setBusy("coupon");
    try {
      await refresh(coupon.trim() || undefined);
      push(coupon.trim() ? `Coupon ${coupon.trim().toUpperCase()} applied` : "Coupon removed", "success");
    } catch (error) {
      push(error instanceof Error ? error.message : "Coupon could not be applied", "error");
      await refresh().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  if (quote.itemCount === 0) {
    return (
      <EmptyState
        icon={<ShoppingBasket className="h-7 w-7" />}
        title="Your cart is empty."
        description="Add some fresh vegetables to get started."
        action={
          <Link href="/vegetables">
            <Button>Shop Vegetables</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <ul className="space-y-3">
        {quote.lines.map((line) => (
          <li key={line.cartItemId} className="card-surface flex gap-3 p-3">
            <Link
              href={`/products/${line.productSlug}`}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-brand-50 sm:h-24 sm:w-24"
            >
              {line.imageUrl ? (
                <Image src={line.imageUrl} alt={line.productName} fill sizes="96px" className="object-cover" />
              ) : null}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/products/${line.productSlug}`}
                    className="block truncate text-sm font-semibold text-ink hover:text-brand-700"
                  >
                    {line.productName}
                  </Link>
                  <p className="text-[11px] text-neutral-500">
                    {line.variantLabel}
                    {line.preparation ? ` • ${line.preparation.toLowerCase()}` : ""} •{" "}
                    {money(line.unitPrice)} each
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${line.productName} from cart`}
                  onClick={() => removeLine(line.cartItemId)}
                  disabled={busy === line.cartItemId}
                  className="rounded-full p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {!line.isAvailable && line.issues.length > 0 ? (
                <p className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> {line.issues.join(" • ")}
                </p>
              ) : (
                <p className="text-[11px] text-brand-700">In stock · {line.availableStock} available</p>
              )}

              <div className="mt-auto flex items-center justify-between gap-2">
                <div className="flex items-center rounded-full border border-brand-200 bg-white">
                  <button
                    type="button"
                    aria-label={`Decrease ${line.productName}`}
                    onClick={() => updateQuantity(line.cartItemId, Math.max(0, line.quantity - 1))}
                    className="grid h-8 w-8 place-items-center rounded-full text-brand-700 hover:bg-brand-50"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className={cn("w-8 text-center text-sm font-semibold", busy === line.cartItemId && "opacity-50")}>
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase ${line.productName}`}
                    onClick={() => updateQuantity(line.cartItemId, line.quantity + 1)}
                    className="grid h-8 w-8 place-items-center rounded-full text-brand-700 hover:bg-brand-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm font-semibold text-ink">{money(line.lineTotal)}</p>
              </div>
            </div>
          </li>
        ))}
        <li className="flex justify-end">
          <Button variant="ghost" size="sm" loading={busy === "clear"} onClick={clearAll}>
            Clear cart
          </Button>
        </li>
      </ul>

      <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <h2 className="text-base font-semibold text-ink">Order summary</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-600">Subtotal</dt>
              <dd className="font-medium">{money(quote.subtotal)}</dd>
            </div>
            {quote.discount > 0 ? (
              <div className="flex justify-between text-brand-700">
                <dt>Coupon discount</dt>
                <dd className="font-medium">− {money(quote.discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-neutral-600">Delivery</dt>
              <dd className="font-medium">
                {quote.deliveryFee === 0 ? "FREE" : money(quote.deliveryFee)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-600">GST ({quote.taxPercent}%)</dt>
              <dd className="font-medium">{money(quote.tax)}</dd>
            </div>
            <div className="mt-2 flex justify-between border-t border-brand-100 pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{money(quote.total)}</dd>
            </div>
          </dl>
          {quote.savings > 0 ? (
            <p className="mt-2 text-[11px] font-medium text-brand-700">
              You are saving {money(quote.savings)} on this cart.
            </p>
          ) : null}

          <div className="mt-4 space-y-2">
            <label htmlFor="coupon" className="text-xs font-semibold text-brand-900">
              Coupon code
            </label>
            <div className="flex gap-2">
              <Input
                id="coupon"
                value={coupon}
                onChange={(event) => setCoupon(event.target.value.toUpperCase())}
                placeholder="WELCOME50"
              />
              <Button variant="outline" loading={busy === "coupon"} onClick={applyCoupon}>
                Apply
              </Button>
            </div>
            {quote.couponMessage ? (
              <p className="flex items-center gap-1 text-[11px] font-medium text-brand-700">
                <Tag className="h-3.5 w-3.5" /> {quote.couponMessage}
              </p>
            ) : null}
            {!quote.delivery.available ? (
              <Alert tone="warn" title="Delivery address needed">
                <span className="block">
                  We use your saved address pincode to calculate delivery fees. Sign in and pick an address at
                  checkout to see the final amount.
                </span>
              </Alert>
            ) : (
              <p className="text-[11px] text-neutral-500">
                Delivering to {quote.delivery.area}, {quote.delivery.pincode} • ETA {quote.delivery.etaMinutes} min
                {quote.subtotal >= quote.delivery.freeDeliveryThreshold
                  ? " • free delivery applied"
                  : ` • free delivery above ${money(quote.delivery.freeDeliveryThreshold)}`}
              </p>
            )}
          </div>

          {quote.checkoutBlocked ? (
            <Alert tone="warn" title="Checkout blocked">
              <span className="block">{quote.checkoutBlocked}</span>
            </Alert>
          ) : null}

          <Link href={isSignedIn ? "/checkout" : "/login?next=/checkout"} className="mt-4 block">
            <Button size="lg" className="w-full" disabled={!quote.delivery.available}>
              {isSignedIn ? "Proceed to checkout" : "Sign in to checkout"}
            </Button>
          </Link>
          {!addressId ? (
            <p className="mt-2 text-center text-[11px] text-neutral-500">
              <Badge tone="neutral">Tip</Badge> Save an address in your profile for instant delivery estimates.
            </p>
          ) : null}
        </Card>

        <Card className="bg-brand-50/60">
          <p className="text-xs leading-relaxed text-brand-900">
            All amounts shown are calculated on the server from live product prices, stock and your delivery zone.
            Nothing here is sent from your browser.
          </p>
        </Card>
      </div>
    </div>
  );
}
