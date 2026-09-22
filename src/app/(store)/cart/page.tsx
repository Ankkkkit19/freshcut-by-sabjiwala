import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getCartQuote, getOrCreateCart } from "@/server/cart";
import { CartView } from "@/components/cart-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your cart",
  description: "Review your FreshCut basket with server-calculated prices, delivery and GST.",
};

export default async function CartPage() {
  const user = await getCurrentUser();
  const cart = await getOrCreateCart();
  let addressId: number | null = null;
  let pincode: string | null = null;
  let area: string | null = null;

  if (user) {
    const rows = await db
      .select({ id: addresses.id, pincode: addresses.pincode, area: addresses.area })
      .from(addresses)
      .where(eq(addresses.userId, user.id))
      .orderBy(desc(addresses.isDefault), asc(addresses.id))
      .limit(1);
    if (rows[0]) {
      addressId = rows[0].id;
      pincode = rows[0].pincode;
      area = rows[0].area;
    }
  }

  const quote = await getCartQuote({
    cartId: cart.cartId,
    pincode,
    area,
    userId: user?.id ?? null,
  });

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <nav aria-label="Breadcrumb" className="text-[11px] text-neutral-500">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span aria-hidden> / </span>
          <span className="text-brand-700">Cart</span>
        </nav>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Your cart</h1>
        <p className="text-sm text-neutral-600">
          {quote.itemCount} item{quote.itemCount === 1 ? "" : "s"} • cart saved to your account, available on web
          and WhatsApp.
        </p>
      </header>
      <CartView initialQuote={quote} addressId={addressId} isSignedIn={Boolean(user)} />
    </div>
  );
}
