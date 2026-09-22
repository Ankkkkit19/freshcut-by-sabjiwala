import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Clock, MapPin, Package, Truck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getOrderDetail } from "@/server/orders";
import { formatDateTime, formatINR, ORDER_STATUS_LABELS } from "@/lib/utils";
import { Badge, Button, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false },
};

export default async function OrderSuccessPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/orders");
  const { orderNumber } = await params;
  const detail = await getOrderDetail(orderNumber.toUpperCase());
  if (!detail) notFound();
  if (detail.order.userId !== user.id && user.role !== "ADMIN") {
    redirect("/orders");
  }

  const steps = ["CONFIRMED", "PREPARING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"];
  const currentIndex = steps.indexOf(detail.order.status);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h1 className="mt-3 text-2xl font-bold text-ink">Thank you! Your order is confirmed.</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Order <span className="font-semibold text-brand-700">{detail.order.orderNumber}</span> •{" "}
          {formatDateTime(detail.order.createdAt)}
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          Our cut kitchen is preparing your vegetables fresh. You will receive WhatsApp updates at every step.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href={`/orders/${detail.order.orderNumber}`}>
            <Button>Track this order</Button>
          </Link>
          <Link href="/products">
            <Button variant="outline">Continue shopping</Button>
          </Link>
        </div>
      </Card>

      {detail.order.status !== "CANCELLED" ? (
        <Card>
          <h2 className="text-base font-semibold text-ink">Order progress</h2>
          <ol className="mt-3 grid gap-2 sm:grid-cols-5">
            {steps.map((step, index) => (
              <li key={step} className="flex items-center gap-2 text-xs sm:flex-col sm:text-center">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full ${
                    index <= currentIndex ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"
                  }`}
                >
                  <Package className="h-4 w-4" />
                </span>
                <span className={index <= currentIndex ? "font-semibold text-ink" : "text-neutral-500"}>
                  {ORDER_STATUS_LABELS[step]}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 flex items-center gap-2 text-xs text-neutral-600">
            <Clock className="h-4 w-4 text-brand-600" />
            Estimated delivery {formatDateTime(detail.order.estimatedDeliveryAt)}
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <MapPin className="h-4 w-4 text-brand-600" /> Delivering to
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
          <p className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
            <Truck className="h-4 w-4 text-brand-600" /> {detail.order.deliverySlot}
          </p>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-ink">Payment</h2>
          <p className="mt-2 text-sm text-neutral-700">
            Method: <strong>{detail.order.paymentMethod}</strong>
          </p>
          <p className="text-sm text-neutral-700">
            Status: <strong>{detail.order.paymentStatus}</strong>
          </p>
          <dl className="mt-3 space-y-1 text-sm">
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
              <dt className="text-neutral-600">Tax</dt>
              <dd>{formatINR(detail.order.tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-brand-100 pt-1.5 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatINR(detail.order.total)}</dd>
            </div>
          </dl>
          {detail.order.couponCode ? (
            <Badge tone="brand" className="mt-2">
              {detail.order.couponCode}
            </Badge>
          ) : null}
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-ink">Items ({detail.items.length})</h2>
        <ul className="mt-3 divide-y divide-neutral-100">
          {detail.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block font-medium text-ink">{item.productName}</span>
                <span className="block text-[11px] text-neutral-500">
                  {item.variantLabel} × {Number(item.quantity)} @ {formatINR(item.unitPrice)}
                </span>
              </span>
              <span className="font-semibold">{formatINR(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
