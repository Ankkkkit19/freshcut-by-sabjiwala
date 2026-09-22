import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listUserOrders } from "@/server/orders";
import { formatDateTime, formatINR, ORDER_STATUS_LABELS } from "@/lib/utils";
import { Badge, Button, Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My orders",
  description: "Track every FreshCut order — status, items, purchase prices and delivery details.",
};

const STATUS_TONE: Record<string, "brand" | "warn" | "info" | "success" | "danger" | "neutral"> = {
  CONFIRMED: "brand",
  PREPARING: "warn",
  PACKED: "info",
  OUT_FOR_DELIVERY: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
};

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/orders");
  const list = await listUserOrders(user.id);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <nav aria-label="Breadcrumb" className="text-[11px] text-neutral-500">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span aria-hidden> / </span>
          <span className="text-brand-700">Orders</span>
        </nav>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">My orders</h1>
        <p className="text-sm text-neutral-600">Order history with prices exactly as purchased.</p>
      </header>

      {list.length === 0 ? (
        <EmptyState
          icon={<Package className="h-7 w-7" />}
          title="No orders yet."
          description="Your fresh grocery orders will appear here."
          action={
            <Link href="/vegetables">
              <Button>Start Shopping</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {list.map((order) => (
            <li key={order.id}>
              <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <div className="flex shrink-0 -space-x-3">
                    {(order.previewImages ?? []).slice(0, 3).map((image, index) => (
                      <span
                        key={`${order.id}-${index}`}
                        className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-white bg-brand-50"
                      >
                        <Image src={image} alt="" fill sizes="48px" className="object-cover" />
                      </span>
                    ))}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/orders/${order.orderNumber}`}
                        className="text-sm font-semibold text-brand-700 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {order.itemCount} item{order.itemCount === 1 ? "" : "s"} • placed{" "}
                      {formatDateTime(order.createdAt)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {order.status === "DELIVERED"
                        ? "Delivered"
                        : `Expected ${formatDateTime(order.estimatedDeliveryAt)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <p className="text-base font-semibold text-ink">{formatINR(order.total)}</p>
                  <Link href={`/orders/${order.orderNumber}`}>
                    <Button size="sm" variant="outline">
                      View details
                    </Button>
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
