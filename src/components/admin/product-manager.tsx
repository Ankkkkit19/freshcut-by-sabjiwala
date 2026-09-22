"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, PackagePlus, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { apiFetch, money } from "@/lib/client";
import { PRODUCT_TYPES, titleCase } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
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

type AdminProduct = {
  id: number;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  images: string[];
  tags: string[];
  aliases: string[];
  preparationTypes: string[];
  productType: string;
  categoryId: number | null;
  categoryName: string | null;
  isActive: boolean;
  isFeatured: boolean;
  variants: { id: number; label: string; price: number; mrp: number | null; stock: number; isActive: boolean }[];
  priceFrom: number;
};

export function ProductManager() {
  const { push } = useToast();
  const [rows, setRows] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (query.trim()) params.set("q", query.trim());
      const result = await apiFetch<{ items: AdminProduct[]; total: number }>(
        `/api/admin/products?${params.toString()}`,
      );
      setRows(result.items);
      setTotal(result.total);
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not load products", "error");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query, push]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = type ? rows.filter((row) => row.productType === type) : rows;

  async function toggle(product: AdminProduct, key: "isActive" | "isFeatured") {
    const next = !product[key];
    // Optimistic toggle, reconciled with the server response.
    setRows((prev) => prev.map((row) => (row.id === product.id ? { ...row, [key]: next } : row)));
    try {
      await apiFetch(`/api/admin/products/${product.id}`, { method: "PATCH", json: { [key]: next } });
      push(`${product.name} ${key === "isActive" ? (next ? "enabled" : "disabled") : next ? "featured" : "unfeatured"}`, "success");
    } catch (error) {
      setRows((prev) => prev.map((row) => (row.id === product.id ? { ...row, [key]: !next } : row)));
      push(error instanceof Error ? error.message : "Update failed", "error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await apiFetch<{ deleted: boolean; disabled?: boolean }>(
        `/api/admin/products/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      push(
        result.deleted ? `${deleteTarget.name} deleted` : `${deleteTarget.name} disabled (referenced by orders)`,
        "info",
      );
      setDeleteTarget(null);
      await load();
    } catch (error) {
      push(error instanceof Error ? error.message : "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Products</h1>
          <p className="text-sm text-neutral-600">
            {total} products • variants, prices, MRP, stock and availability.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} loading={loading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Link href="/admin/products/new">
            <Button>
              <PackagePlus className="h-4 w-4" /> New product
            </Button>
          </Link>
        </div>
      </header>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label htmlFor="product-search" className="mb-1 block text-[11px] font-semibold text-brand-900">
              Search
            </label>
            <Input
              id="product-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="potato, aloo, salad mix…"
            />
          </div>
          <div>
            <label htmlFor="product-type" className="mb-1 block text-[11px] font-semibold text-brand-900">
              Product type
            </label>
            <Select id="product-type" value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">All types</option>
              {PRODUCT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <LoadingRows rows={8} cols={6} />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No products found."
            description="Adjust your search or create a new product."
            action={
              <Link href="/admin/products/new">
                <Button>Create product</Button>
              </Link>
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Category</Th>
                  <Th>Type</Th>
                  <Th>Variants</Th>
                  <Th className="text-right">From</Th>
                  <Th className="text-right">Stock</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => {
                  const stock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
                  return (
                    <tr key={product.id} className="hover:bg-brand-50/40">
                      <Td>
                        <Link href={`/admin/products/${product.id}`} className="font-medium text-brand-700 hover:underline">
                          {product.name}
                        </Link>
                        <span className="block text-[11px] text-neutral-500">/{product.slug}</span>
                      </Td>
                      <Td className="text-[12px]">{product.categoryName ?? "—"}</Td>
                      <Td className="text-[12px]">{titleCase(product.productType)}</Td>
                      <Td className="text-[12px]">{product.variants.length}</Td>
                      <Td className="text-right">{money(product.priceFrom)}</Td>
                      <Td className="text-right">
                        <span className={stock <= 0 ? "font-semibold text-red-600" : ""}>{stock}</span>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          <button type="button" onClick={() => toggle(product, "isActive")} aria-pressed={product.isActive}>
                            <Badge tone={product.isActive ? "success" : "neutral"}>
                              {product.isActive ? "active" : "inactive"}
                            </Badge>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggle(product, "isFeatured")}
                            aria-pressed={product.isFeatured}
                          >
                            <Badge tone={product.isFeatured ? "brand" : "neutral"}>
                              {product.isFeatured ? "featured" : "standard"}
                            </Badge>
                          </button>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex gap-1">
                          <Link href={`/admin/products/${product.id}`}>
                            <Button size="sm" variant="ghost" aria-label={`Edit ${product.name}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={`/products/${product.slug}`} target="_blank">
                            <Button size="sm" variant="ghost" aria-label={`View ${product.name} on storefront`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete ${product.name}`}
                            onClick={() => setDeleteTarget(product)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.name ?? "product"}?`}
        description="Products referenced by existing orders are disabled instead of deleted, so order history stays intact."
        confirmLabel="Delete product"
        destructive
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
