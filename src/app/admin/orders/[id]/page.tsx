import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MapPin, Phone, User } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getOrderDetail } from "@/server/orders";
import { formatDateTime, formatINR, toNum } from "@/lib/utils";
import { Badge, Button, Card, Table, Td, Th } from "@/components/ui";
import { OrderStatusControl } from "@/components/admin/orders-admin";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const detail = await getOrderDetail(id.toUpperCase());
  if (!detail) notFound();

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <nav aria-label="Breadcrumb" className="text-[11px] text-neutral-500">
            <Link href="/admin/orders" className="hover:underline">
              Orders
            </Link>
            <span aria-hidden> / </span>
            <span className="text-brand-700">{detail.order.orderNumber}</span>
          </nav>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">{detail.order.orderNumber}</h1>
          <p className="text-sm text-neutral-600">
            Placed {formatDateTime(detail.order.createdAt)} • source {detail.order.source.toLowerCase()} •{" "}
            {detail.order.paymentMethod} {detail.order.paymentStatus.toLowerCase()}
          </p>
        </div>
        <Link href="/admin/orders">
          <Button variant="outline" size="sm">
            Back to list
          </Button>
        </Link>
      </header>

      <Card>
        <h2 className="text-base font-semibold text-ink">Update status</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Allowed transitions are enforced server-side; cancellations restore stock and notify the customer.
        </p>
        <OrderStatusControl orderNumber={detail.order.orderNumber} status={detail.order.status} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <h2 className="text-base font-semibold text-ink">Items ({detail.items.length})</h2>
          <div className="pt-2">
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Variant</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Price</Th>
                  <Th className="text-right">MRP</Th>
                  <Th className="text-right">Line total</Th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id}>
                    <Td>{item.productName}</Td>
                    <Td>
                      {item.variantLabel}
                      {item.preparation ? ` • ${item.preparation.toLowerCase()}` : ""}
                    </Td>
                    <Td className="text-right">{toNum(item.quantity)}</Td>
                    <Td className="text-right">{formatINR(item.unitPrice)}</Td>
                    <Td className="text-right text-neutral-500">
                      {item.unitMrp ? formatINR(item.unitMrp) : "—"}
                    </Td>
                    <Td className="text-right font-medium">{formatINR(item.lineTotal)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <p className="mt-3 text-[11px] text-neutral-500">
            Purchase-time prices are stored on each order item — later price changes never alter history.
          </p>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="text-base font-semibold text-ink">Customer</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
              <li className="flex items-center gap-2">
                <User className="h-4 w-4 text-brand-600" /> {detail.customerName}
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-brand-600" /> {detail.customerEmail}
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-brand-600" /> {detail.customerPhone ?? "Not provided"}
              </li>
            </ul>
          </Card>

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
              Phone {detail.order.deliveryAddress.phone}
              {detail.order.deliveryAddress.landmark ? (
                <>
                  <br />
                  Landmark: {detail.order.deliveryAddress.landmark}
                </>
              ) : null}
            </p>
            <p className="mt-2 text-xs text-neutral-500">Slot: {detail.order.deliverySlot}</p>
            {detail.order.notes ? (
              <p className="mt-2 rounded-lg bg-brand-50/60 p-2 text-[11px]">Note: {detail.order.notes}</p>
            ) : null}
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-ink">Amounts</h2>
            <dl className="mt-2 space-y-1 text-sm">
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
              <div className="flex justify-between border-t border-brand-100 pt-1.5 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatINR(detail.order.total)}</dd>
              </div>
            </dl>
            {detail.order.couponCode ? (
              <Badge tone="brand" className="mt-2">
                coupon {detail.order.couponCode}
              </Badge>
            ) : null}
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-ink">Audit trail</h2>
            {detail.history.length === 0 ? (
              <p className="mt-2 text-xs text-neutral-500">No admin actions recorded for this order yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-[11px] text-neutral-600">
                {detail.history.map((entry) => (
                  <li key={entry.id}>
                    <span className="font-medium text-ink">{entry.action.replace(/_/g, " ")}</span> •{" "}
                    {entry.actorLabel} • {entry.source?.toLowerCase()} • {formatDateTime(entry.createdAt)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
