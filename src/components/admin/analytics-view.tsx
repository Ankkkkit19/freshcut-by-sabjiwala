"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiFetch, money } from "@/lib/client";
import { formatQty, toNum } from "@/lib/utils";
import { BarChart, LineAreaChart, StatusDonut } from "@/components/charts";
import { Button, Card, EmptyState, Input, LoadingRows, Select, StatCard, Table, Td, Th, useToast } from "@/components/ui";

type AnalyticsPayload = {
  range: { label: string };
  analytics: {
    dailyRevenue: { label: string; revenue: number; orders: number }[];
    monthlyRevenue: { label: string; revenue: number; orders: number }[];
    statusMix: { status: string; count: number; revenue: number }[];
    topProducts: { name: string; quantity: number; revenue: number }[];
    topCategories: { name: string; revenue: number; orders: number }[];
    customers: { newCustomers: number; returningCustomers: number };
    coupons: { code: string; uses: number; discount: number }[];
    inventory: { lowStock: number; outOfStock: number; stockValue: number };
  };
};

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
];

export function AnalyticsView() {
  const { push } = useToast();
  const [range, setRange] = useState("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ range });
      if (range === "custom" && from && to) {
        params.set("from", from);
        params.set("to", to);
      }
      const result = await apiFetch<AnalyticsPayload>(`/api/admin/analytics?${params.toString()}`);
      setData(result);
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not load analytics", "error");
    } finally {
      setLoading(false);
    }
  }, [range, from, to, push]);

  useEffect(() => {
    void load();
  }, [load]);

  const analytics = data?.analytics;
  const totalRevenue = (analytics?.dailyRevenue ?? []).reduce((sum, row) => sum + row.revenue, 0);
  const totalOrders = (analytics?.dailyRevenue ?? []).reduce((sum, row) => sum + row.orders, 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Analytics</h1>
          <p className="text-sm text-neutral-600">
            Every figure is aggregated from orders, order items and inventory records — {data?.range.label ?? ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="a-range" className="mb-1 block text-[11px] font-semibold text-brand-900">
              Range
            </label>
            <Select id="a-range" value={range} onChange={(event) => setRange(event.target.value)} className="w-40">
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
                <label htmlFor="a-from" className="mb-1 block text-[11px] font-semibold text-brand-900">
                  From
                </label>
                <Input id="a-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </div>
              <div>
                <label htmlFor="a-to" className="mb-1 block text-[11px] font-semibold text-brand-900">
                  To
                </label>
                <Input id="a-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </div>
            </>
          ) : null}
          <Button variant="outline" onClick={() => void load()} loading={loading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue in range" value={money(totalRevenue)} loading={loading} />
        <StatCard label="Orders in range" value={totalOrders} tone="sky" loading={loading} />
        <StatCard
          label="New vs returning"
          value={`${analytics?.customers.newCustomers ?? 0} / ${analytics?.customers.returningCustomers ?? 0}`}
          tone="amber"
          loading={loading}
        />
        <StatCard
          label="Stock value"
          value={money(analytics?.inventory.stockValue ?? 0)}
          hint={`${analytics?.inventory.lowStock ?? 0} low • ${analytics?.inventory.outOfStock ?? 0} out`}
          loading={loading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <h2 className="text-base font-semibold text-ink">Daily revenue</h2>
          {loading ? (
            <div className="pt-3">
              <LoadingRows rows={4} cols={3} />
            </div>
          ) : (
            <LineAreaChart
              data={(analytics?.dailyRevenue ?? []).map((row) => ({ label: row.label, value: row.revenue }))}
            />
          )}
        </Card>
        <Card>
          <h2 className="text-base font-semibold text-ink">Order status distribution</h2>
          {loading ? (
            <div className="pt-3">
              <LoadingRows rows={4} cols={2} />
            </div>
          ) : (
            <StatusDonut
              data={(analytics?.statusMix ?? []).map((row) => ({ label: row.status, value: row.count }))}
            />
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold text-ink">Top selling products</h2>
          <div className="pt-3">
            {loading ? (
              <LoadingRows rows={5} cols={2} />
            ) : (analytics?.topProducts.length ?? 0) === 0 ? (
              <EmptyState title="No sales in this range" />
            ) : (
              <BarChart
                data={(analytics?.topProducts ?? []).map((row) => ({
                  label: `${row.name} (${formatQty(row.quantity)})`,
                  value: row.revenue,
                  secondary: 1,
                }))}
                valueLabel="Revenue"
              />
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-ink">Top categories</h2>
          <div className="pt-3">
            {loading ? (
              <LoadingRows rows={5} cols={2} />
            ) : (analytics?.topCategories.length ?? 0) === 0 ? (
              <EmptyState title="No category sales yet" />
            ) : (
              <BarChart
                data={(analytics?.topCategories ?? []).map((row) => ({
                  label: row.name,
                  value: row.revenue,
                  secondary: 1,
                }))}
                valueLabel="Revenue"
              />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold text-ink">Monthly revenue</h2>
          <div className="pt-3">
            {loading ? (
              <LoadingRows rows={4} cols={3} />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Month</Th>
                    <Th className="text-right">Orders</Th>
                    <Th className="text-right">Revenue</Th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.monthlyRevenue ?? []).map((row) => (
                    <tr key={row.label}>
                      <Td>{row.label}</Td>
                      <Td className="text-right">{row.orders}</Td>
                      <Td className="text-right font-medium">{money(row.revenue)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-ink">Coupon performance</h2>
          <div className="pt-3">
            {loading ? (
              <LoadingRows rows={4} cols={3} />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Coupon</Th>
                    <Th className="text-right">Uses</Th>
                    <Th className="text-right">Discount given</Th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.coupons ?? []).map((row) => (
                    <tr key={row.code}>
                      <Td>{row.code}</Td>
                      <Td className="text-right">{row.uses}</Td>
                      <Td className="text-right">{money(row.discount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
          <p className="mt-3 text-[11px] text-neutral-500">
            Stock value uses current sellable quantity × variant price ({formatQty(toNum(analytics?.inventory.stockValue ?? 0))}).
          </p>
        </Card>
      </div>
    </div>
  );
}
