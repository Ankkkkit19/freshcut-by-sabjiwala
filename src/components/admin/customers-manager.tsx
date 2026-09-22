"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Users } from "lucide-react";
import { apiFetch, money } from "@/lib/client";
import { formatDate, timeAgo } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingRows,
  StatCard,
  Table,
  Td,
  Th,
  useToast,
} from "@/components/ui";

type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  orderCount: number;
  totalSpent: string;
  lastOrderAt: string | null;
};

export function CustomersManager() {
  const { push } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const data = await apiFetch<{ customers: Customer[] }>(`/api/admin/customers?${params.toString()}`);
      setCustomers(data.customers);
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not load customers", "error");
    } finally {
      setLoading(false);
    }
  }, [query, push]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function toggleActive(customer: Customer) {
    const next = !customer.isActive;
    setCustomers((prev) => prev.map((row) => (row.id === customer.id ? { ...row, isActive: next } : row)));
    try {
      await apiFetch("/api/admin/customers", { method: "PATCH", json: { id: customer.id, isActive: next } });
      push(`${customer.name} ${next ? "enabled" : "disabled"}`, "success");
    } catch (error) {
      setCustomers((prev) => prev.map((row) => (row.id === customer.id ? { ...row, isActive: !next } : row)));
      push(error instanceof Error ? error.message : "Update failed", "error");
    }
  }

  const totals = customers.reduce(
    (acc, customer) => ({
      spent: acc.spent + Number(customer.totalSpent),
      orders: acc.orders + customer.orderCount,
      active: acc.active + (customer.isActive ? 1 : 0),
    }),
    { spent: 0, orders: 0, active: 0 },
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Customers</h1>
          <p className="text-sm text-neutral-600">
            Aggregated order value and recency per customer. No passwords or tokens are exposed.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} loading={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Customers shown" value={customers.length} icon={<Users className="h-5 w-5" />} loading={loading} />
        <StatCard label="Orders (lifetime)" value={totals.orders} tone="sky" loading={loading} />
        <StatCard label="Revenue (lifetime)" value={money(totals.spent)} tone="amber" loading={loading} />
      </div>

      <Card>
        <label htmlFor="customer-search" className="mb-1 block text-[11px] font-semibold text-brand-900">
          Search customers
        </label>
        <Input
          id="customer-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, email or phone"
        />
      </Card>

      <Card>
        {loading ? (
          <LoadingRows rows={6} cols={6} />
        ) : customers.length === 0 ? (
          <EmptyState title="No customers matched" description="Try another search term." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Phone</Th>
                <Th className="text-right">Orders</Th>
                <Th className="text-right">Total spent</Th>
                <Th>Joined</Th>
                <Th>Last order</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-brand-50/40">
                  <Td>
                    <span className="block font-medium text-ink">{customer.name}</span>
                    <span className="block text-[11px] text-neutral-500">{customer.email}</span>
                  </Td>
                  <Td className="text-[12px]">{customer.phone ?? "—"}</Td>
                  <Td className="text-right">{customer.orderCount}</Td>
                  <Td className="text-right font-medium">{money(customer.totalSpent)}</Td>
                  <Td className="text-[11px] text-neutral-500">{formatDate(customer.createdAt)}</Td>
                  <Td className="text-[11px] text-neutral-500">
                    {customer.lastOrderAt ? timeAgo(customer.lastOrderAt) : "never"}
                  </Td>
                  <Td>
                    <button type="button" onClick={() => toggleActive(customer)} aria-pressed={customer.isActive}>
                      <Badge tone={customer.isActive ? "success" : "neutral"}>
                        {customer.isActive ? "active" : "disabled"}
                      </Badge>
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
