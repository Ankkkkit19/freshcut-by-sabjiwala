"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, CreditCard, MapPin, Tag, Truck, Wallet } from "lucide-react";
import { apiFetch, money } from "@/lib/client";
import type { AddressRecord, Quote } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCartUi } from "@/components/store";
import { AddressForm } from "@/components/address-form";
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, Spinner, useToast } from "@/components/ui";

const STEPS = ["Address", "Slot", "Coupon", "Summary", "Payment"] as const;
const SLOTS = ["Express (next 45 min)", "Today 6–8 PM", "Today 8–10 PM", "Tomorrow 7–9 AM"];

export function CheckoutWizard({
  initialQuote,
  addresses,
  user,
}: {
  initialQuote: Quote;
  addresses: AddressRecord[];
  user: { name: string; email: string; phone: string | null };
}) {
  const router = useRouter();
  const { push } = useToast();
  const setCount = useCartUi((s) => s.setCount);
  const [step, setStep] = useState(0);
  const [addressList, setAddressList] = useState(addresses);
  const [addressId, setAddressId] = useState<number | null>(addresses[0]?.id ?? null);
  const [slot, setSlot] = useState(SLOTS[0]!);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [quote, setQuote] = useState(initialQuote);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "UPI">("COD");
  const [notes, setNotes] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  const loadQuote = useCallback(
    async (nextAddressId: number | null, couponCode: string | null) => {
      setLoadingQuote(true);
      try {
        const params = new URLSearchParams();
        if (nextAddressId) params.set("addressId", String(nextAddressId));
        if (couponCode) params.set("coupon", couponCode);
        const data = await apiFetch<{ quote: Quote }>(`/api/checkout?${params.toString()}`);
        setQuote(data.quote);
        setCount(data.quote.itemCount);
        return data.quote;
      } catch (error) {
        push(error instanceof Error ? error.message : "Could not refresh totals", "error");
        return null;
      } finally {
        setLoadingQuote(false);
      }
    },
    [push, setCount],
  );

  useEffect(() => {
    if (addressId) void loadQuote(addressId, appliedCoupon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressId]);

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setAppliedCoupon(null);
      await loadQuote(addressId, null);
      push("Coupon removed", "info");
      return;
    }
    const next = await loadQuote(addressId, code);
    if (next?.coupon) {
      setAppliedCoupon(code);
      push(`${code} applied — you saved ${money(next.discount)}`, "success");
    } else {
      setAppliedCoupon(null);
    }
  }

  async function createAddress(input: Record<string, unknown>) {
    setSavingAddress(true);
    setAddressError(null);
    try {
      const data = await apiFetch<{ address: AddressRecord }>("/api/profile/addresses", {
        method: "POST",
        json: input,
      });
      setAddressList((prev) => [data.address, ...prev.filter((a) => a.id !== data.address.id)]);
      setAddressId(data.address.id);
      setFormOpen(false);
      push("Address saved", "success");
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : "Could not save address");
    } finally {
      setSavingAddress(false);
    }
  }

  async function placeOrder() {
    if (!addressId) {
      push("Select a delivery address first", "error");
      return;
    }
    setPlacing(true);
    try {
      const data = await apiFetch<{ order: { orderNumber: string } }>("/api/checkout", {
        method: "POST",
        json: {
          addressId,
          couponCode: appliedCoupon ?? undefined,
          deliverySlot: slot,
          paymentMethod: paymentMethod === "UPI" ? "COD" : "COD",
          notes: notes || undefined,
        },
      });
      setCount(0);
      push("Order placed successfully", "success");
      router.push(`/checkout/success/${data.order.orderNumber}`);
    } catch (error) {
      push(error instanceof Error ? error.message : "Order could not be placed", "error");
      await loadQuote(addressId, appliedCoupon);
    } finally {
      setPlacing(false);
    }
  }

  if (quote.itemCount === 0) {
    return (
      <EmptyState
        title="Nothing to check out yet."
        description="Your cart is empty — add fresh vegetables to continue."
        action={
          <Link href="/vegetables">
            <Button>Shop Vegetables</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-4">
        <ol className="flex flex-wrap gap-2 text-[11px] font-medium">
          {STEPS.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => setStep(index)}
                aria-current={step === index ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5",
                  step === index
                    ? "border-brand-500 bg-brand-50 text-brand-800"
                    : step > index
                      ? "border-brand-200 bg-white text-brand-700"
                      : "border-neutral-200 bg-white text-neutral-500",
                )}
              >
                {step > index ? <Check className="h-3.5 w-3.5" /> : <span>{index + 1}</span>}
                {label}
              </button>
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                <MapPin className="h-4 w-4 text-brand-600" /> Delivery address
              </h2>
              <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
                Add new address
              </Button>
            </div>
            {addressList.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-brand-200 p-4 text-sm text-neutral-500">
                No saved addresses yet. Add one to continue — we use its pincode to calculate delivery fees.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {addressList.map((address) => (
                  <li key={address.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-xl border p-3 text-sm",
                        addressId === address.id ? "border-brand-500 bg-brand-50/60" : "border-neutral-200",
                      )}
                    >
                      <input
                        type="radio"
                        name="address"
                        className="mt-1"
                        checked={addressId === address.id}
                        onChange={() => setAddressId(address.id)}
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">{address.fullName}</span>
                          <Badge tone="neutral">{address.type.toLowerCase()}</Badge>
                          {address.isDefault ? <Badge tone="brand">default</Badge> : null}
                        </span>
                        <span className="mt-0.5 block text-xs text-neutral-600">
                          {address.line1}, {address.street ? `${address.street}, ` : ""}
                          {address.area}, {address.city}, {address.state} {address.pincode}
                          {address.landmark ? ` • ${address.landmark}` : ""}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-neutral-500">Phone {address.phone}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end">
              <Button disabled={!addressId} onClick={() => setStep(1)}>
                Continue to slot
              </Button>
            </div>
          </Card>
        ) : null}

        {step === 1 ? (
          <Card>
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Truck className="h-4 w-4 text-brand-600" /> Delivery slot
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Express slots are {quote.delivery.etaMinutes ?? 45} minutes for {quote.delivery.area ?? "your area"}.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {SLOTS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSlot(option)}
                  aria-pressed={slot === option}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-sm",
                    slot === option ? "border-brand-500 bg-brand-50" : "border-neutral-200 hover:border-brand-300",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <label htmlFor="notes" className="text-xs font-semibold text-brand-900">
                Delivery notes (optional)
              </label>
              <Input
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ring the bell twice, leave at door…"
              />
            </div>
            <div className="mt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button onClick={() => setStep(2)}>Continue to coupon</Button>
            </div>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card>
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Tag className="h-4 w-4 text-brand-600" /> Coupon
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Coupons are validated server-side against your live cart value and usage limits.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                value={couponInput}
                onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                placeholder="WELCOME50"
                aria-label="Coupon code"
              />
              <Button variant="outline" onClick={applyCoupon} loading={loadingQuote}>
                Apply
              </Button>
            </div>
            {quote.coupon ? (
              <Alert tone="success" title={`${quote.coupon.code} applied`}>
                You saved {money(quote.discount)} on this order.
              </Alert>
            ) : null}
            <div className="mt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)}>Review order</Button>
            </div>
          </Card>
        ) : null}

        {step === 3 ? (
          <Card>
            <h2 className="text-base font-semibold text-ink">Order summary</h2>
            <ul className="mt-3 divide-y divide-neutral-100">
              {quote.lines.map((line) => (
                <li key={line.cartItemId} className="flex items-center gap-3 py-2">
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-brand-50">
                    {line.imageUrl ? (
                      <Image src={line.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{line.productName}</span>
                    <span className="block text-[11px] text-neutral-500">
                      {line.variantLabel} × {line.quantity}
                    </span>
                  </span>
                  <span className="text-sm font-semibold">{money(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={() => setStep(4)}>Proceed to payment</Button>
            </div>
          </Card>
        ) : null}

        {step === 4 ? (
          <Card>
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <CreditCard className="h-4 w-4 text-brand-600" /> Payment
            </h2>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("COD")}
                aria-pressed={paymentMethod === "COD"}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm",
                  paymentMethod === "COD" ? "border-brand-500 bg-brand-50" : "border-neutral-200",
                )}
              >
                <Wallet className="h-5 w-5 text-brand-600" />
                <span>
                  <span className="block font-semibold text-ink">Cash on delivery</span>
                  <span className="block text-[11px] text-neutral-500">
                    Pay the delivery partner in cash or UPI on arrival.
                  </span>
                </span>
              </button>
              <div className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3 text-sm opacity-70">
                <CreditCard className="h-5 w-5 text-neutral-400" />
                <span>
                  <span className="block font-semibold text-ink">Card / Netbanking</span>
                  <span className="block text-[11px] text-neutral-500">
                    Not configured in this environment — no payment gateway credentials are set.
                  </span>
                </span>
              </div>
            </div>
            {quote.checkoutBlocked ? (
              <Alert tone="warn" title="Cannot place order">
                <span className="block">{quote.checkoutBlocked}</span>
              </Alert>
            ) : null}
            <div className="mt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button
                loading={placing}
                disabled={Boolean(quote.checkoutBlocked) || !addressId}
                onClick={placeOrder}
              >
                Place order • {money(quote.total)}
              </Button>
            </div>
          </Card>
        ) : null}
      </div>

      <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Payable now</h2>
            {loadingQuote ? <Spinner /> : null}
          </div>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-600">Items ({quote.itemCount})</dt>
              <dd>{money(quote.subtotal)}</dd>
            </div>
            {quote.discount > 0 ? (
              <div className="flex justify-between text-brand-700">
                <dt>Discount</dt>
                <dd>− {money(quote.discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-neutral-600">Delivery</dt>
              <dd>{quote.deliveryFee === 0 ? "FREE" : money(quote.deliveryFee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-600">GST ({quote.taxPercent}%)</dt>
              <dd>{money(quote.tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-brand-100 pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{money(quote.total)}</dd>
            </div>
          </dl>
          <div className="mt-3 space-y-1 text-[11px] text-neutral-500">
            <p>Customer: {user.name} • {user.email}</p>
            {quote.delivery.available ? (
              <p>
                Zone: {quote.delivery.area}, {quote.delivery.pincode} • ETA {quote.delivery.etaMinutes} min
              </p>
            ) : (
              <p className="text-amber-700">Select an address inside a delivery zone to continue.</p>
            )}
          </div>
        </Card>
        <Card className="bg-brand-50/60">
          <p className="text-xs leading-relaxed text-brand-900">
            The server recalculates every amount at order time — cart values, coupon eligibility, stock and
            delivery fee are re-verified before your order is created.
          </p>
        </Card>
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Add a delivery address"
        description="Fields match Indian delivery requirements. Pincode drives delivery fee and ETA."
      >
        <AddressForm
          submitting={savingAddress}
          error={addressError}
          onSubmit={createAddress}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>
    </div>
  );
}
