import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { BadgePercent, Tag } from "lucide-react";
import { db } from "@/db";
import { coupons, offers } from "@/db/schema";
import { formatDate, toNum } from "@/lib/utils";
import { Badge, Button, Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Offers & coupons",
  description:
    "Live FreshCut offers and coupon codes — WELCOME50, FRESH20, SAVE100 — with exact minimum order values and validity from the store database.",
};

export default async function OffersPage() {
  const now = new Date();
  const [activeOffers, liveCoupons] = await Promise.all([
    db
      .select()
      .from(offers)
      .where(and(eq(offers.isActive, true), sql`(${offers.expiresAt} IS NULL OR ${offers.expiresAt} > now())`))
      .orderBy(asc(offers.sortOrder)),
    db
      .select()
      .from(coupons)
      .where(and(eq(coupons.isActive, true), sql`(${coupons.expiresAt} IS NULL OR ${coupons.expiresAt} > now())`))
      .orderBy(asc(coupons.minOrderValue)),
  ]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <nav aria-label="Breadcrumb" className="text-[11px] text-neutral-500">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span aria-hidden> / </span>
          <span className="text-brand-700">Offers</span>
        </nav>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Offers &amp; coupons</h1>
        <p className="text-sm text-neutral-600">
          Every offer below is live in the store database. Coupons are validated on the server at checkout —
          never in the browser.
        </p>
      </header>

      {activeOffers.length === 0 ? (
        <EmptyState
          icon={<BadgePercent className="h-7 w-7" />}
          title="No offers running right now."
          description="New FreshCut offers drop every week — check back soon."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {activeOffers.map((offer) => (
            <li key={offer.id} className="card-surface overflow-hidden">
              {offer.imageUrl ? (
                <span className="relative block h-40 bg-brand-50">
                  <Image src={offer.imageUrl} alt={offer.title} fill sizes="600px" className="object-cover" />
                </span>
              ) : null}
              <div className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {offer.badge ? <Badge tone="brand">{offer.badge}</Badge> : null}
                  {offer.discountText ? <Badge tone="success">{offer.discountText}</Badge> : null}
                </div>
                <h2 className="text-lg font-semibold text-ink">{offer.title}</h2>
                <p className="text-sm text-neutral-600">{offer.subtitle}</p>
                <p className="text-xs leading-relaxed text-neutral-500">{offer.description}</p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {offer.code ? (
                    <span className="rounded-lg border border-dashed border-brand-300 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
                      Code: {offer.code}
                    </span>
                  ) : null}
                  <span className="text-[11px] text-neutral-500">
                    {offer.expiresAt ? `Valid till ${formatDate(offer.expiresAt)}` : "No expiry"}
                  </span>
                </div>
                <Link href={offer.ctaHref ?? "/products"}>
                  <Button className="mt-2">Shop this offer</Button>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="coupons-heading">
        <h2 id="coupons-heading" className="mb-3 text-lg font-semibold text-ink">
          Coupon codes you can use today
        </h2>
        {liveCoupons.length === 0 ? (
          <EmptyState icon={<Tag className="h-7 w-7" />} title="No active coupons." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liveCoupons.map((coupon) => (
              <li key={coupon.id}>
                <Card className="h-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-brand-600 px-2.5 py-1 text-sm font-bold text-white">
                      {coupon.code}
                    </span>
                    <Badge tone="neutral">
                      {coupon.type === "PERCENTAGE" ? `${toNum(coupon.value)}% off` : `₹${toNum(coupon.value)} off`}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-ink">{coupon.description}</p>
                  <ul className="mt-2 space-y-1 text-[11px] text-neutral-500">
                    <li>Minimum order ₹{toNum(coupon.minOrderValue)}</li>
                    {coupon.maxDiscount ? <li>Maximum discount ₹{toNum(coupon.maxDiscount)}</li> : null}
                    <li>
                      {coupon.perUserLimit} use{coupon.perUserLimit === 1 ? "" : "s"} per customer
                      {coupon.usageLimit ? ` • ${coupon.usageLimit} total redemptions` : ""}
                    </li>
                    {coupon.expiresAt ? <li>Expires {formatDate(coupon.expiresAt)}</li> : null}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
