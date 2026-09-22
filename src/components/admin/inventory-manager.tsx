"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Filter, PackageMinus, PackagePlus, RefreshCw, Trash } from "lucide-react";
import { apiFetch, money } from "@/lib/client";
import { formatDateTime, formatQty } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingRows,
  Modal,
  Select,
  StatCard,
  Table,
  Td,
  Th,
  useToast,
} from "@/components/ui";

type StockRow = {
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  isActive: boolean;
  variantActive: boolean;
  label: string;
  unit: string;
  price: string;
  stock: string;
  yieldRatio: string | null;
  onHand: string | null;
  soldQty: string | null;
  wastageQty: string | null;
  damagedQty: string | null;
  lowStockThreshold: string | null;
  updatedAt: string | null;
};

type TransactionRow = {
  id: number;
  type: string;
  quantity: string;
  balanceAfter: string;
  reason: string | null;
  source: string;
  createdAt: string;
  orderId: number | null;
  variantLabel: string;
  productName: string;
};

type LowStockRow = {
  variantId: number;
  productName: string;
  label: string;
  stock: string;
  unit: string;
  threshold: string | null;
};

const MODES = [
  { key: "ADJUSTMENT", label: "Correct stock (signed)", hint: "Positive adds, negative removes" },
  { key: "RAW", label: "Raw intake", hint: "Adds raw material" },
  { key: "DAMAGED", label: "Damaged", hint: "Removes damaged units" },
  { key: "WASTAGE", label: "Wastage", hint: "Removes wastage" },
];

export function InventoryManager() {
  const { push } = useToast();
  const [data, setData] = useState<{
    overview: StockRow[];
    transactions: TransactionRow[];
    lowStock: LowStockRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"ADJUSTMENT" | "RAW" | "DAMAGED" | "WASTAGE" | "produce">("ADJUSTMENT");
  const [target, setTarget] = useState<StockRow | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<{
        overview: StockRow[];
        transactions: TransactionRow[];
        lowStock: LowStockRow[];
      }>("/api/admin/inventory");
      setData(result);
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not load inventory", "error");
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const list = data?.overview ?? [];
    return list.filter((row) => {
      const matches = `${row.productName} ${row.label} ${row.unit}`.toLowerCase().includes(query.toLowerCase());
      if (!matches) return false;
      const stock = Number(row.stock);
      const threshold = Number(row.lowStockThreshold ?? 5);
      if (filter === "low") return stock > 0 && stock <= threshold;
      if (filter === "out") return stock <= 0;
      return true;
    });
  }, [data, query, filter]);

  const totals = useMemo(() => {
    const list = data?.overview ?? [];
    const out = list.filter((row) => Number(row.stock) <= 0).length;
    const low = list.filter((row) => {
      const stock = Number(row.stock);
      return stock > 0 && stock <= Number(row.lowStockThreshold ?? 5);
    }).length;
    const value = list.reduce((sum, row) => sum + Number(row.stock) * Number(row.price), 0);
    return { out, low, value, variants: list.length };
  }, [data]);

  function openAdjust(row: StockRow, nextMode: typeof mode) {
    setTarget(row);
    setMode(nextMode);
    setQuantity(nextMode === "produce" ? "10" : "1");
    setReason("");
    setModalOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    setSaving(true);
    try {
      if (mode === "produce") {
        await apiFetch("/api/admin/inventory", {
          method: "POST",
          json: {
            mode: "produce",
            variantId: target.variantId,
            quantity: Math.abs(Number(quantity)),
            reason: reason || undefined,
          },
        });
        push(`Prepared stock created from ${quantity} raw units`, "success");
      } else {
        const signed = mode === "ADJUSTMENT" ? Number(quantity) : Math.abs(Number(quantity));
        await apiFetch("/api/admin/inventory", {
          method: "POST",
          json: { mode: "adjust", variantId: target.variantId, quantity: signed, type: mode, reason: reason || undefined },
        });
        push("Stock updated and recorded in the ledger", "success");
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      push(error instanceof Error ? error.message : "Stock update failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Inventory</h1>
          <p className="text-sm text-neutral-600">
            Live stock, ledger history and adjustments. Negative stock is impossible — the ledger rejects it.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} loading={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tracked variants" value={totals.variants} icon={<Boxes className="h-5 w-5" />} loading={loading} />
        <StatCard label="Low stock" value={totals.low} tone="amber" icon={<Filter className="h-5 w-5" />} loading={loading} />
        <StatCard label="Out of stock" value={totals.out} tone="rose" icon={<PackageMinus className="h-5 w-5" />} loading={loading} />
        <StatCard label="Stock value" value={money(totals.value)} tone="sky" icon={<PackagePlus className="h-5 w-5" />} loading={loading} />
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label htmlFor="inv-search" className="mb-1 block text-[11px] font-semibold text-brand-900">
              Search variant
            </label>
            <Input
              id="inv-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="potato 1 kg"
            />
          </div>
          <div>
            <label htmlFor="inv-filter" className="mb-1 block text-[11px] font-semibold text-brand-900">
              Filter
            </label>
            <Select
              id="inv-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value as "all" | "low" | "out")}
              className="w-40"
            >
              <option value="all">All stock</option>
              <option value="low">Low stock only</option>
              <option value="out">Out of stock only</option>
            </Select>
          </div>
        </div>

        <div className="pt-3">
          {loading ? (
            <LoadingRows rows={8} cols={6} />
          ) : rows.length === 0 ? (
            <EmptyState title="No variants matched" description="Try a different filter or search term." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Variant</Th>
                  <Th className="text-right">On hand</Th>
                  <Th className="text-right">Sold</Th>
                  <Th className="text-right">Wastage</Th>
                  <Th className="text-right">Threshold</Th>
                  <Th className="text-right">Value</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const stock = Number(row.stock);
                  const threshold = Number(row.lowStockThreshold ?? 5);
                  return (
                    <tr key={row.variantId} className="hover:bg-brand-50/40">
                      <Td>
                        <span className="block font-medium text-ink">{row.productName}</span>
                        <span className="block text-[11px] text-neutral-500">
                          {row.isActive && row.variantActive ? "sellable" : "disabled"}
                          {row.yieldRatio ? ` • yield ${Number(row.yieldRatio)}` : ""}
                        </span>
                      </Td>
                      <Td>{row.label}</Td>
                      <Td className="text-right">
                        <Badge tone={stock <= 0 ? "danger" : stock <= threshold ? "warn" : "success"}>
                          {formatQty(row.stock)} {row.unit.toLowerCase()}
                        </Badge>
                      </Td>
                      <Td className="text-right text-[12px]">{formatQty(row.soldQty ?? 0)}</Td>
                      <Td className="text-right text-[12px]">{formatQty(row.wastageQty ?? 0)}</Td>
                      <Td className="text-right text-[12px]">{formatQty(row.lowStockThreshold ?? 5)}</Td>
                      <Td className="text-right text-[12px]">{money(stock * Number(row.price))}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" onClick={() => openAdjust(row, "ADJUSTMENT")}>
                            Adjust
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openAdjust(row, "RAW")}>
                            Add
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openAdjust(row, "WASTAGE")}>
                            Wastage
                          </Button>
                          {row.yieldRatio ? (
                            <Button size="sm" variant="ghost" onClick={() => openAdjust(row, "produce")}>
                              Produce
                            </Button>
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-ink">Inventory history</h2>
        <p className="text-xs text-neutral-500">Every adjustment, sale, wastage and raw intake is recorded.</p>
        <div className="pt-3">
          {loading ? (
            <LoadingRows rows={6} cols={5} />
          ) : (data?.transactions.length ?? 0) === 0 ? (
            <EmptyState title="No transactions yet" description="Stock movements will appear here." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Product</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Balance</Th>
                  <Th>Reason</Th>
                  <Th>Source</Th>
                </tr>
              </thead>
              <tbody>
                {data?.transactions.map((txn) => (
                  <tr key={txn.id}>
                    <Td className="text-[11px] text-neutral-500">{formatDateTime(txn.createdAt)}</Td>
                    <Td>
                      {txn.productName} <span className="text-[11px] text-neutral-500">{txn.variantLabel}</span>
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          txn.type === "SOLD"
                            ? "brand"
                            : txn.type === "WASTAGE" || txn.type === "DAMAGED"
                              ? "warn"
                              : "neutral"
                        }
                      >
                        {txn.type.toLowerCase()}
                      </Badge>
                    </Td>
                    <Td className={`text-right ${Number(txn.quantity) < 0 ? "text-red-600" : "text-brand-700"}`}>
                      {Number(txn.quantity) > 0 ? "+" : ""}
                      {formatQty(txn.quantity)}
                    </Td>
                    <Td className="text-right">{formatQty(txn.balanceAfter)}</Td>
                    <Td className="text-[11px] text-neutral-500">{txn.reason ?? "—"}</Td>
                    <Td className="text-[11px] text-neutral-500">{txn.source.toLowerCase()}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          mode === "produce"
            ? `Produce prepared stock — ${target?.productName ?? ""}`
            : `Stock ${mode.toLowerCase()} — ${target?.productName ?? ""}`
        }
        description={
          mode === "produce"
            ? `Raw units are consumed and usable output is credited using the yield ratio${
                target?.yieldRatio ? ` (${Number(target.yieldRatio)})` : ""
              }.`
            : "Every manual change creates an audit record with the previous and new balance."
        }
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="rounded-xl bg-brand-50/60 p-3 text-xs text-brand-900">
            <p>
              Current stock: <strong>{formatQty(target?.stock ?? 0)}</strong> {target?.unit.toLowerCase()}
            </p>
            <p className="mt-1">
              Sold: {formatQty(target?.soldQty ?? 0)} • Wastage: {formatQty(target?.wastageQty ?? 0)} • Damaged:{" "}
              {formatQty(target?.damagedQty ?? 0)}
            </p>
          </div>
          {mode !== "produce" ? (
            <Field label="Operation" htmlFor="inv-mode" hint={MODES.find((m) => m.key === mode)?.hint}>
              <Select
                id="inv-mode"
                value={mode}
                onChange={(event) => setMode(event.target.value as typeof mode)}
              >
                {MODES.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field
            label={mode === "produce" ? "Raw quantity consumed" : "Quantity"}
            htmlFor="inv-quantity"
            hint={mode === "ADJUSTMENT" ? "Use negative values to reduce stock" : undefined}
          >
            <Input
              id="inv-quantity"
              type="number"
              step="0.001"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </Field>
          <Field label="Reason" htmlFor="inv-reason">
            <Input
              id="inv-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Supplier delivery, spoilage, stock count…"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              <Trash className="h-4 w-4" /> Apply
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
