import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getCartQuote, getOrCreateCart } from "@/server/cart";
import { CheckoutWizard } from "@/components/checkout-wizard";
import type { AddressRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Secure FreshCut checkout — address, slot, coupon, server-verified totals and payment.",
};

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkout");

  const [addressRows, cart] = await Promise.all([
    db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, user.id))
      .orderBy(desc(addresses.isDefault), asc(addresses.id)),
    getOrCreateCart(),
  ]);

  const primary = addressRows[0];
  const quote = await getCartQuote({
    cartId: cart.cartId,
    userId: user.id,
    pincode: primary?.pincode ?? null,
    area: primary?.area ?? null,
  });

  const addressList: AddressRecord[] = addressRows.map((row) => ({
    id: row.id,
    label: row.label,
    fullName: row.fullName,
    phone: row.phone,
    line1: row.line1,
    street: row.street,
    area: row.area,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    landmark: row.landmark,
    type: row.type,
    isDefault: row.isDefault,
  }));

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Checkout</h1>
        <p className="text-sm text-neutral-600">
          {quote.itemCount} item{quote.itemCount === 1 ? "" : "s"} • amounts calculated on the server from live
          prices, stock and delivery zones.
        </p>
      </header>
      <CheckoutWizard
        initialQuote={quote}
        addresses={addressList}
        user={{ name: user.name, email: user.email, phone: user.phone }}
      />
    </div>
  );
}
