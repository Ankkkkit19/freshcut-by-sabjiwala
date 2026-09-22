import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Circle, Clock, MapPin, MessageCircle, Package, Truck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getOrderDetail } from "@/server/orders";
import { formatDateTime, formatINR, ORDER_STATUS_LABELS, toNum } from "@/lib/utils";
import { Badge, Button, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order details",
  robots: { index: false },
};

const STEPS = ["CONFIRMED", "PREPARING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/orders");
  const { orderNumber } = await params;
  const detail = await getOrderDetail(orderNumber.toUpperCase());
  if (!detail) notFound();
  // Order access control: only the owner (or an admin) can read this order.
  if (detail.order.userId !== user.id && user.role !== "ADMIN") notFound();

  const currentIndex = STEPS.indexOf(detail.order.status as (typeof STEPS)[number]);
  const savings = toNum(detail.order.discount);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <nav aria-label="Breadcrumb" className="text-[11px] text-neutral-500">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span aria-hidden> / </span>
          <Link href="/orders" className="hover:underline">
            Orders
          </Link>
          <span aria-hidden> / </span>
          <span className="text-brand-700">{detail.order.orderNumber}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Order {detail.order.orderNumber}</h1>
          <Badge tone={detail.order.status === "DELIVERED" ? "success" : detail.order.status === "CANCELLED" ? "danger" : "brand"}>
            {ORDER_STATUS_LABELS[detail.order.status]}
          </Badge>
          {detail.order.source === "WHATSAPP" ? <Badge tone="info">placed on WhatsApp</Badge> : null}
        </div>
        <p className="text-sm text-neutral-600">Placed {formatDateTime(detail.order.createdAt)}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card>
            <h2 className="text-base font-semibold text-ink">Items ({detail.items.length})</h2>
            <ul className="mt-3 divide-y divide-neutral-100">
              {detail.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3">
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-brand-50">
                    {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    {item.productSlug ? (
                      <Link href={`/products/${item.productSlug}`} className="block text-sm font-medium text-ink hover:text-brand-700">
                        {item.productName}
                      </Link>
                    ) : (
                      <span className="block text-sm font-medium text-ink">{item.productName}</span>
                    )}
                    <span className="block text-[11px] text-neutral-500">
                      {item.variantLabel}
                      {item.preparation ? ` • ${item.preparation.toLowerCase()}` : ""} × {toNum(item.quantity)} @{" "}
                      {formatINR(item.unitPrice)}
                      {item.unitMrp && toNum(item.unitMrp) > toNum(item.unitPrice) ? (
                        <span className="ml-1 line-through">{formatINR(item.unitMrp)}</span>
                      ) : null}
                    </span>
                    <span className="block text-[10px] text-neutral-400">
                      Price locked at purchase time
                    </span>
                  </span>
                  <span className="text-sm font-semibold">{formatINR(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            {savings > 0 ? (
              <p className="mt-2 text-xs font-medium text-brand-700">
                You saved {formatINR(savings)} {detail.order.couponCode ? `with ${detail.order.couponCode}` : ""}
              </p>
            ) : null}
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-ink">Order timeline</h2>
            {detail.order.status === "CANCELLED" ? (
              <p className="mt-2 text-sm text-red-600">
                Cancelled {formatDateTime(detail.order.cancelledAt)}
                {detail.order.cancelReason ? ` — ${detail.order.cancelReason}` : ""}
              </p>
            ) : (
              <ol className="mt-3 space-y-2">
                {STEPS.map((step, index) => (
                  <li key={step} className="flex items-center gap-3 text-sm">
                    {index <= currentIndex ? (
                      <CheckCircle2 className="h-5 w-5 text-brand-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-neutral-300" />
                    )}
                    <span className={index <= currentIndex ? "font-medium text-ink" : "text-neutral-500"}>
                      {ORDER_STATUS_LABELS[step]}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {detail.history.length > 0 ? (
              <ul className="mt-4 space-y-1 border-t border-neutral-100 pt-3 text-[11px] text-neutral-500">
                {detail.history.map((entry) => (
                  <li key={entry.id}>
                    {formatDateTime(entry.createdAt)} • {entry.action.replace(/_/g, " ").toLowerCase()} •{" "}
                    {entry.source?.toLowerCase()}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <MapPin className="h-4 w-4 text-brand-600" /> Delivery address
            </h2>
            <p className="mt-2 text-sm text-neutral-700">
              {detail.order.deliveryAddress.fullName}
              <br />
              {detail.order.deliveryAddress.line1}
              {detail.order.deliveryAddress.street ? `, ${detail.order.deliveryAddress.street}` : ""}
              <br />
              {detail.order.deliveryAddress.area}, {detail.order.deliveryAddress.city}{" "}
              {detail.order.deliveryAddress.pincode}
              <br />
              {detail.order.deliveryAddress.phone}
            </p>
            <p className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
              <Truck className="h-4 w-4 text-brand-600" /> {detail.order.deliverySlot}
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
              <Clock className="h-4 w-4 text-brand-600" />
              {detail.order.status === "DELIVERED"
                ? `Delivered ${formatDateTime(detail.order.deliveredAt)}`
                : `Expected ${formatDateTime(detail.order.estimatedDeliveryAt)}`}
            </p>
            {detail.order.notes ? (
              <p className="mt-2 rounded-lg bg-brand-50/60 p-2 text-[11px] text-brand-900">
                Note: {detail.order.notes}
              </p>
            ) : null}
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-ink">Bill details</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-600">Subtotal</dt>
                <dd>{formatINR(detail.order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-600">Discount</dt>
                <dd>− {formatINR(detail.order.discount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-600">Delivery</dt>
                <dd>{formatINR(detail.order.deliveryFee)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-600">GST</dt>
                <dd>{formatINR(detail.order.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-brand-100 pt-2 text-base font-semibold">
                <dt>Total paid</dt>
                <dd>{formatINR(detail.order.total)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-[11px] text-neutral-500">
              {detail.order.paymentMethod} • {detail.order.paymentStatus}
            </p>
          </Card>

          <Card className="bg-brand-50/60">
            <h2 className="flex items-center gap-2 text-base font-semibold text-brand-900">
              <MessageCircle className="h-4 w-4" /> Need help?
            </h2>
            <p className="mt-1 text-xs text-brand-900">
              Reply “track {detail.order.orderNumber}” on WhatsApp once your number is linked, or write to our
              support email.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/profile">
                <Button size="sm" variant="outline">
                  Link WhatsApp
                </Button>
              </Link>
              <Link href="/products">
                <Button size="sm" variant="ghost">
                  <Package className="h-4 w-4" /> Order again
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
