"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, RefreshCw } from "lucide-react";
import { apiFetch, money } from "@/lib/client";
import { ORDER_STATUS_LABELS, formatDateTime } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingRows,
  Pagination,
  Select,
  Table,
  Td,
  Th,
  useToast,
} from "@/components/ui";

type AdminOrder = {
  id: number;
  orderNumber: string;
  status: string;
  total: string;
  paymentMethod: string;
  paymentStatus: string;
  source: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  itemCount: number;
};

const STATUSES = ["ALL", "CONFIRMED", "PREPARING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

export function OrdersAdmin() {
  const { push } = useToast();
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [data, setData] = useState<{ items: AdminOrder[]; total: number; page: number; pageSize: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (query.trim()) params.set("q", query.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const result = await apiFetch<{ items: AdminOrder[]; total: number; page: number; pageSize: number }>(
        `/api/admin/orders?${params.toString()}`,
      );
      setData(result);
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not load orders", "error");
    } finally {
      setLoading(false);
    }
  }, [status, page, pageSize, query, from, to, push]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(orderNumber: string, nextStatus: string) {
    setUpdating(orderNumber);
    try {
      await apiFetch(`/api/admin/orders/${orderNumber}`, {
        method: "PATCH",
        json: { status: nextStatus },
      });
      push(`${orderNumber} → ${ORDER_STATUS_LABELS[nextStatus] ?? nextStatus}`, "success");
      await load();
    } catch (error) {
      push(error instanceof Error ? error.message : "Status update failed", "error");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Orders</h1>
          <p className="text-sm text-neutral-600">
            Search, filter and progress orders. Status changes are audited and notify the customer.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} loading={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </header>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="order-search" className="mb-1 block text-[11px] font-semibold text-brand-900">
              Search
            </label>
            <Input
              id="order-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="SW10001, name or email"
            />
          </div>
          <div>
            <label htmlFor="order-status" className="mb-1 block text-[11px] font-semibold text-brand-900">
              Status
            </label>
            <Select
              id="order-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              {STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All statuses" : ORDER_STATUS_LABELS[option]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="order-from" className="mb-1 block text-[11px] font-semibold text-brand-900">
              From
            </label>
            <Input
              id="order-from"
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label htmlFor="order-to" className="mb-1 block text-[11px] font-semibold text-brand-900">
              To
            </label>
            <Input
              id="order-to"
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <LoadingRows rows={8} cols={6} />
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No orders matched" description="Adjust the filters or date range." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Items</Th>
                  <Th>Total</Th>
                  <Th>Payment</Th>
                  <Th>Status</Th>
                  <Th>Placed</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {data?.items.map((order) => (
                  <tr key={order.id} className="hover:bg-brand-50/40">
                    <Td>
                      <Link
                        href={`/admin/orders/${order.orderNumber}`}
                        className="font-semibold text-brand-700 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <span className="ml-2 text-[10px] uppercase text-neutral-400">{order.source}</span>
                    </Td>
                    <Td>
                      <span className="block font-medium text-ink">{order.customerName}</span>
                      <span className="block text-[11px] text-neutral-500">{order.customerEmail}</span>
                    </Td>
                    <Td>{order.itemCount}</Td>
                    <Td className="font-medium">{money(order.total)}</Td>
                    <Td className="text-[11px] text-neutral-500">
                      {order.paymentMethod} • {order.paymentStatus.toLowerCase()}
                    </Td>
                    <Td>
                      <label className="sr-only" htmlFor={`status-${order.id}`}>
                        Update status for {order.orderNumber}
                      </label>
                      <Select
                        id={`status-${order.id}`}
                        value={order.status}
                        disabled={updating === order.orderNumber}
                        onChange={(event) => updateStatus(order.orderNumber, event.target.value)}
                        className="h-8 text-xs"
                      >
                        {STATUSES.filter((s) => s !== "ALL").map((option) => (
                          <option key={option} value={option}>
                            {ORDER_STATUS_LABELS[option]}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td className="text-[11px] text-neutral-500">{formatDateTime(order.createdAt)}</Td>
                    <Td>
                      <Link href={`/admin/orders/${order.orderNumber}`}>
                        <Button size="sm" variant="ghost" aria-label={`View ${order.orderNumber}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={data?.page ?? 1}
              pageSize={data?.pageSize ?? pageSize}
              total={data?.total ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}

export function OrderStatusControl({
  orderNumber,
  status,
}: {
  orderNumber: string;
  status: string;
}) {
  const { push } = useToast();
  const [current, setCurrent] = useState(status);
  const [saving, setSaving] = useState(false);

  async function update(next: string) {
    setSaving(true);
    try {
      const data = await apiFetch<{ order: { status: string } }>(`/api/admin/orders/${orderNumber}`, {
        method: "PATCH",
        json: { status: next },
      });
      setCurrent(data.order.status);
      push(`${orderNumber} is now ${ORDER_STATUS_LABELS[data.order.status] ?? data.order.status}`, "success");
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not update status", "error");
    } finally {
      setSaving(false);
    }
  }

  const options = ["CONFIRMED", "PREPARING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={current === "DELIVERED" ? "success" : current === "CANCELLED" ? "danger" : "brand"}>
        {ORDER_STATUS_LABELS[current] ?? current}
      </Badge>
      {options
        .filter((option) => option !== current)
        .slice(0, 4)
        .map((option) => (
          <Button
            key={option}
            size="sm"
            variant={option === "CANCELLED" ? "danger" : "outline"}
            loading={saving}
            onClick={() => update(option)}
          >
            Mark {ORDER_STATUS_LABELS[option]?.toLowerCase() ?? option}
          </Button>
        ))}
    </div>
  );
}
