"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  IndianRupee,
  Package,
  ShoppingCart,
  Truck,
  UserPlus,
  Users,
} from "lucide-react";
import { apiFetch, money } from "@/lib/client";
import { ORDER_STATUS_LABELS, formatDateTime, formatQty } from "@/lib/utils";
import { LineAreaChart } from "@/components/charts";
import { Badge, Button, Card, EmptyState, Input, LoadingRows, Select, StatCard, Table, Td, Th } from "@/components/ui";

type StatsPayload = {
  range: { key: string; from: string; to: string; label: string };
  stats: {
    orders: number;
    revenue: number;
    avgOrderValue: number;
    statusCounts: Record<string, number>;
    openOrders: number;
    totalCustomers: number;
    newCustomers: number;
    lowStockCount: number;
    outOfStockCount: number;
    whatsappOrders: number;
    revenueSeries: { date: string; revenue: number; orders: number }[];
    recentOrders: {
      orderNumber: string;
      status: string;
      total: string;
      customerName: string;
      createdAt: string;
      source: string;
    }[];
  };
  lowStock: {
    variantId: number;
    productName: string;
    label: string;
    stock: string;
    unit: string;
    threshold: string | null;
  }[];
};

const RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
];

export function DashboardView({ adminName }: { adminName: string }) {
  const [range, setRange] = useState("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range });
      if (range === "custom" && from && to) {
        params.set("from", from);
        params.set("to", to);
      }
      const result = await apiFetch<StatsPayload>(`/api/admin/stats?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }, [range, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const stats = data?.stats;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">
            {greeting}, {adminName.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-neutral-600">
            Live operational numbers from the store database — {data?.range.label ?? "loading"}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="range" className="mb-1 block text-[11px] font-semibold text-brand-900">
              Date range
            </label>
            <Select id="range" value={range} onChange={(event) => setRange(event.target.value)} className="w-40">
              {RANGES.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          {range === "custom" ? (
            <>
              <div>
                <label htmlFor="from" className="mb-1 block text-[11px] font-semibold text-brand-900">
                  From
                </label>
                <Input id="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </div>
              <div>
                <label htmlFor="to" className="mb-1 block text-[11px] font-semibold text-brand-900">
                  To
                </label>
                <Input id="to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </div>
            </>
          ) : null}
          <Button variant="outline" onClick={() => void load()} loading={loading}>
            Refresh
          </Button>
        </div>
      </header>

      {error ? (
        <Card className="border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Orders (${range === "custom" ? "custom" : range})`}
          value={stats?.orders ?? 0}
          hint={`${stats?.whatsappOrders ?? 0} via WhatsApp`}
          icon={<ShoppingCart className="h-5 w-5" />}
          loading={loading}
        />
        <StatCard
          label="Revenue"
          value={money(stats?.revenue ?? 0)}
          hint={`AOV ${money(stats?.avgOrderValue ?? 0)}`}
          icon={<IndianRupee className="h-5 w-5" />}
          tone="sky"
          loading={loading}
        />
        <StatCard
          label="Open orders"
          value={stats?.openOrders ?? 0}
          hint={`${stats?.statusCounts?.OUT_FOR_DELIVERY ?? 0} out for delivery`}
          icon={<Truck className="h-5 w-5" />}
          tone="amber"
          loading={loading}
        />
        <StatCard
          label="Customers"
          value={stats?.totalCustomers ?? 0}
          hint={`${stats?.newCustomers ?? 0} new in range`}
          icon={<Users className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(["CONFIRMED", "PREPARING", "PACKED", "DELIVERED"] as const).map((status) => (
          <StatCard
            key={status}
            label={ORDER_STATUS_LABELS[status] ?? status}
            value={stats?.statusCounts?.[status] ?? 0}
            icon={<Package className="h-5 w-5" />}
            tone="brand"
            loading={loading}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <h2 className="text-base font-semibold text-ink">Revenue overview</h2>
          <p className="text-xs text-neutral-500">
            Daily revenue from non-cancelled orders in the selected range.
          </p>
          {loading ? (
            <div className="py-10">
              <LoadingRows rows={3} cols={3} />
            </div>
          ) : (
            <LineAreaChart
              data={(stats?.revenueSeries ?? []).map((point) => ({
                label: point.date.slice(5),
                value: point.revenue,
              }))}
            />
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Low stock</h2>
            <Link href="/admin/inventory" className="text-xs font-semibold text-brand-700 hover:underline">
              Manage
            </Link>
          </div>
          <p className="text-xs text-neutral-500">
            {stats?.lowStockCount ?? 0} low • {stats?.outOfStockCount ?? 0} out of stock
          </p>
          {loading ? (
            <div className="pt-3">
              <LoadingRows rows={4} cols={2} />
            </div>
          ) : (data?.lowStock.length ?? 0) === 0 ? (
            <EmptyState icon={<Boxes className="h-6 w-6" />} title="Everything is well stocked" />
          ) : (
            <ul className="mt-3 space-y-2">
              {data?.lowStock.map((item) => (
                <li key={item.variantId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{item.productName}</span>
                    <span className="block text-[11px] text-neutral-500">{item.label}</span>
                  </span>
                  <Badge tone={Number(item.stock) <= 0 ? "danger" : "warn"}>
                    {Number(item.stock) <= 0 ? "out" : `${formatQty(item.stock)} ${item.unit.toLowerCase()}`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          {stats && stats.outOfStockCount > 0 ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" /> {stats.outOfStockCount} variants unavailable to customers
            </p>
          ) : null}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Recent orders</h2>
          <Link href="/admin/orders" className="text-xs font-semibold text-brand-700 hover:underline">
            All orders
          </Link>
        </div>
        {loading ? (
          <div className="pt-3">
            <LoadingRows rows={5} cols={5} />
          </div>
        ) : (stats?.recentOrders.length ?? 0) === 0 ? (
          <EmptyState title="No orders yet" description="New orders will appear here as customers check out." />
        ) : (
          <div className="pt-2">
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th>Source</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Placed</Th>
                </tr>
              </thead>
              <tbody>
                {stats?.recentOrders.map((order) => (
                  <tr key={order.orderNumber} className="hover:bg-brand-50/40">
                    <Td>
                      <Link href={`/admin/orders/${order.orderNumber}`} className="font-semibold text-brand-700 hover:underline">
                        {order.orderNumber}
                      </Link>
                    </Td>
                    <Td>{order.customerName}</Td>
                    <Td>
                      <Badge
                        tone={
                          order.status === "DELIVERED"
                            ? "success"
                            : order.status === "CANCELLED"
                              ? "danger"
                              : order.status === "PREPARING"
                                ? "warn"
                                : "brand"
                        }
                      >
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </Badge>
                    </Td>
                    <Td>{order.source.toLowerCase()}</Td>
                    <Td className="text-right font-medium">{money(order.total)}</Td>
                    <Td className="text-[11px] text-neutral-500">{formatDateTime(order.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/admin/products/new" className="block">
          <Card className="h-full transition hover:border-brand-300">
            <Package className="h-5 w-5 text-brand-600" />
            <p className="mt-2 text-sm font-semibold text-ink">Add a product</p>
            <p className="text-xs text-neutral-500">Create a product with pack sizes and stock.</p>
          </Card>
        </Link>
        <Link href="/admin/inventory" className="block">
          <Card className="h-full transition hover:border-brand-300">
            <Boxes className="h-5 w-5 text-brand-600" />
            <p className="mt-2 text-sm font-semibold text-ink">Stock adjustment</p>
            <p className="text-xs text-neutral-500">Add stock, mark wastage or record raw intake.</p>
          </Card>
        </Link>
        <Link href="/admin/whatsapp" className="block">
          <Card className="h-full transition hover:border-brand-300">
            <UserPlus className="h-5 w-5 text-brand-600" />
            <p className="mt-2 text-sm font-semibold text-ink">WhatsApp console</p>
            <p className="text-xs text-neutral-500">Simulate customer and admin chats, inspect webhooks.</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
