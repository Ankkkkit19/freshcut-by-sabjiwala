"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { apiFetch, money } from "@/lib/client";
import { formatDate, titleCase, toNum } from "@/lib/utils";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  LoadingRows,
  Modal,
  Select,
  Table,
  Td,
  Textarea,
  Th,
  useToast,
} from "@/components/ui";

type FieldType = "text" | "number" | "textarea" | "select" | "checkbox" | "date" | "csv" | "lines" | "ingredients";

type FieldConfig = {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  hint?: string;
  required?: boolean;
};

type ColumnConfig = {
  key: string;
  label: string;
  kind?: "text" | "money" | "boolean" | "date" | "list" | "percent";
};

type ResourceConfig = {
  title: string;
  description: string;
  singular: string;
  columns: ColumnConfig[];
  fields: FieldConfig[];
};

export const RESOURCE_CONFIGS: Record<string, ResourceConfig> = {
  categories: {
    title: "Categories",
    description: "Storefront taxonomy. Order controls homepage sequence.",
    singular: "category",
    columns: [
      { key: "name", label: "Name" },
      { key: "slug", label: "Slug" },
      { key: "sortOrder", label: "Order" },
      { key: "isActive", label: "Active", kind: "boolean" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", hint: "Generated from name when blank" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "imageUrl", label: "Image URL", type: "text" },
      { name: "sortOrder", label: "Sort order", type: "number" },
      { name: "isActive", label: "Active", type: "checkbox" },
    ],
  },
  coupons: {
    title: "Coupons",
    description: "Percentage or fixed discounts with usage limits and applicability.",
    singular: "coupon",
    columns: [
      { key: "code", label: "Code" },
      { key: "type", label: "Type" },
      { key: "value", label: "Value", kind: "money" },
      { key: "minOrderValue", label: "Min order", kind: "money" },
      { key: "maxDiscount", label: "Max discount", kind: "money" },
      { key: "perUserLimit", label: "Per user" },
      { key: "expiresAt", label: "Expires", kind: "date" },
      { key: "isActive", label: "Active", kind: "boolean" },
    ],
    fields: [
      { name: "code", label: "Code", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "type", label: "Type", type: "select", options: ["PERCENTAGE", "FIXED"] },
      { name: "value", label: "Value (₹ or %)", type: "number", required: true },
      { name: "minOrderValue", label: "Minimum order ₹", type: "number" },
      { name: "maxDiscount", label: "Maximum discount ₹", type: "number", hint: "Blank = no cap" },
      { name: "startsAt", label: "Starts at", type: "date" },
      { name: "expiresAt", label: "Expires at", type: "date" },
      { name: "usageLimit", label: "Total usage limit", type: "number", hint: "Blank = unlimited" },
      { name: "perUserLimit", label: "Uses per customer", type: "number" },
      { name: "applicableCategoryIds", label: "Applicable category ids", type: "csv", hint: "Comma separated category ids" },
      { name: "applicableProductIds", label: "Applicable product ids", type: "csv", hint: "Comma separated product ids" },
      { name: "isActive", label: "Active", type: "checkbox" },
    ],
  },
  offers: {
    title: "Offers",
    description: "Homepage and /offers banners stored in the database.",
    singular: "offer",
    columns: [
      { key: "title", label: "Title" },
      { key: "discountText", label: "Discount" },
      { key: "code", label: "Coupon" },
      { key: "expiresAt", label: "Expires", kind: "date" },
      { key: "isActive", label: "Active", kind: "boolean" },
    ],
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "subtitle", label: "Subtitle", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "imageUrl", label: "Image URL", type: "text" },
      { name: "badge", label: "Badge", type: "text" },
      { name: "discountText", label: "Discount text", type: "text" },
      { name: "code", label: "Coupon code", type: "text" },
      { name: "ctaHref", label: "CTA link", type: "text" },
      { name: "startsAt", label: "Starts at", type: "date" },
      { name: "expiresAt", label: "Expires at", type: "date" },
      { name: "sortOrder", label: "Sort order", type: "number" },
      { name: "isActive", label: "Active", type: "checkbox" },
    ],
  },
  recipes: {
    title: "Recipes",
    description: "Recipe ideas with linked FreshCut ingredients.",
    singular: "recipe",
    columns: [
      { key: "name", label: "Recipe" },
      { key: "difficulty", label: "Difficulty" },
      { key: "prepMinutes", label: "Prep min" },
      { key: "cookMinutes", label: "Cook min" },
      { key: "ingredients", label: "Ingredients", kind: "list" },
      { key: "isActive", label: "Active", kind: "boolean" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "imageUrl", label: "Image URL", type: "text" },
      { name: "prepMinutes", label: "Prep minutes", type: "number" },
      { name: "cookMinutes", label: "Cook minutes", type: "number" },
      { name: "servings", label: "Servings", type: "number" },
      { name: "difficulty", label: "Difficulty", type: "select", options: ["EASY", "MEDIUM", "HARD"] },
      { name: "instructions", label: "Instructions", type: "lines", hint: "One step per line" },
      {
        name: "ingredients",
        label: "Ingredients",
        type: "ingredients",
        hint: "One per line as: Name | quantity | productId (optional)",
      },
      { name: "isActive", label: "Active", type: "checkbox" },
    ],
  },
  zones: {
    title: "Delivery zones",
    description: "Pincode level fees, minimums, free-delivery thresholds and ETA.",
    singular: "zone",
    columns: [
      { key: "pincode", label: "Pincode" },
      { key: "area", label: "Area" },
      { key: "city", label: "City" },
      { key: "deliveryFee", label: "Fee", kind: "money" },
      { key: "minOrderValue", label: "Min order", kind: "money" },
      { key: "freeDeliveryThreshold", label: "Free above", kind: "money" },
      { key: "etaMinutes", label: "ETA min" },
      { key: "isActive", label: "Active", kind: "boolean" },
    ],
    fields: [
      { name: "pincode", label: "Pincode", type: "text", required: true },
      { name: "area", label: "Area", type: "text", required: true },
      { name: "city", label: "City", type: "text", required: true },
      { name: "state", label: "State", type: "text", required: true },
      { name: "deliveryFee", label: "Delivery fee ₹", type: "number" },
      { name: "minOrderValue", label: "Minimum order ₹", type: "number" },
      { name: "freeDeliveryThreshold", label: "Free delivery above ₹", type: "number" },
      { name: "etaMinutes", label: "ETA minutes", type: "number" },
      { name: "isActive", label: "Active", type: "checkbox" },
    ],
  },
};

type Row = Record<string, unknown>;

function toFormValues(fields: FieldConfig[], row: Row | null): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = row?.[field.name];
    if (field.type === "checkbox") {
      values[field.name] = raw === undefined ? field.name === "isActive" : Boolean(raw);
    } else if (field.type === "csv") {
      values[field.name] = Array.isArray(raw) ? (raw as unknown[]).join(", ") : "";
    } else if (field.type === "lines") {
      values[field.name] = Array.isArray(raw) ? (raw as string[]).join("\n") : "";
    } else if (field.type === "ingredients") {
      values[field.name] = Array.isArray(raw)
        ? (raw as { name: string; quantity: string; productId: number | null }[])
            .map((ing) => `${ing.name} | ${ing.quantity}${ing.productId ? ` | ${ing.productId}` : ""}`)
            .join("\n")
        : "";
    } else if (field.type === "date") {
      values[field.name] = raw ? String(raw).slice(0, 10) : "";
    } else if (field.type === "number") {
      values[field.name] = raw === null || raw === undefined ? "" : String(raw);
    } else {
      values[field.name] = raw ?? "";
    }
  }
  return values;
}

function serialize(fields: FieldConfig[], values: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.name];
    if (field.type === "checkbox") {
      payload[field.name] = Boolean(value);
    } else if (field.type === "number") {
      if (value === "" || value === null || value === undefined) {
        payload[field.name] = field.required ? 0 : null;
      } else {
        payload[field.name] = Number(value);
      }
    } else if (field.type === "csv") {
      payload[field.name] = String(value ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => Number(part))
        .filter((num) => Number.isFinite(num));
    } else if (field.type === "lines") {
      payload[field.name] = String(value ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    } else if (field.type === "ingredients") {
      payload[field.name] = String(value ?? "")
        .split("\n")
        .map((line) => line.split("|").map((part) => part.trim()))
        .filter((parts) => parts[0])
        .map((parts) => ({
          name: parts[0]!,
          quantity: parts[1] ?? "as needed",
          productId: parts[2] ? Number(parts[2]) : null,
        }));
    } else {
      payload[field.name] = value === "" ? "" : value;
    }
  }
  return payload;
}

function renderCell(row: Row, column: ColumnConfig) {
  const value = row[column.key];
  if (column.kind === "boolean") {
    return <Badge tone={value ? "success" : "neutral"}>{value ? "yes" : "no"}</Badge>;
  }
  if (column.kind === "money") {
    return value === null || value === undefined ? "—" : money(value as string | number);
  }
  if (column.kind === "date") {
    return value ? formatDate(value as string) : "—";
  }
  if (column.kind === "list") {
    const list = Array.isArray(value) ? value : [];
    return (
      <span className="text-[11px] text-neutral-500">
        {list.length === 0
          ? "—"
          : list
              .slice(0, 3)
              .map((item) => (typeof item === "object" && item && "name" in item ? String((item as { name: string }).name) : String(item)))
              .join(", ")}
      </span>
    );
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : "—";
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && value.length > 60) return `${value.slice(0, 60)}…`;
  return String(value);
}

export function ResourceManager({ resource }: { resource: keyof typeof RESOURCE_CONFIGS }) {
  const config = RESOURCE_CONFIGS[resource];
  const { push } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>(() => toFormValues(config!.fields, null));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ items: Row[] }>(`/api/admin/resource/${resource}`);
      setRows(data.items);
    } catch (error) {
      push(error instanceof Error ? error.message : "Could not load data", "error");
    } finally {
      setLoading(false);
    }
  }, [resource, push]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setValues(toFormValues(config!.fields, null));
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(row: Row) {
    setEditing(row);
    setValues(toFormValues(config!.fields, row));
    setFormError(null);
    setFormOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = serialize(config!.fields, values);
      if (editing) {
        await apiFetch(`/api/admin/resource/${resource}/${editing.id}`, { method: "PATCH", json: payload });
        push(`${titleCase(config!.singular)} updated`, "success");
      } else {
        await apiFetch(`/api/admin/resource/${resource}`, { method: "POST", json: payload });
        push(`${titleCase(config!.singular)} created`, "success");
      }
      setFormOpen(false);
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/admin/resource/${resource}/${deleteTarget.id}`, { method: "DELETE" });
      push(`${titleCase(config!.singular)} deleted`, "info");
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
          <h1 className="text-xl font-bold text-ink sm:text-2xl">{config!.title}</h1>
          <p className="text-sm text-neutral-600">{config!.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} loading={loading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New {config!.singular}
          </Button>
        </div>
      </header>

      <Card>
        {loading ? (
          <LoadingRows rows={6} cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={`No ${config!.title.toLowerCase()} yet`}
            description="Create the first record to get started."
            action={<Button onClick={openCreate}>Create {config!.singular}</Button>}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                {config!.columns.map((column) => (
                  <Th key={column.key}>{column.label}</Th>
                ))}
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)} className="hover:bg-brand-50/40">
                  {config!.columns.map((column) => (
                    <Td key={column.key}>{renderCell(row, column)}</Td>
                  ))}
                  <Td>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => openEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Delete"
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${config!.singular}` : `New ${config!.singular}`}
        description={config!.description}
        size="lg"
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {config!.fields.map((field) => (
              <div key={field.name} className={field.type === "textarea" || field.type === "lines" || field.type === "ingredients" ? "sm:col-span-2" : ""}>
                <Field label={field.label} htmlFor={field.name} hint={field.hint}>
                  {field.type === "textarea" ? (
                    <Textarea
                      id={field.name}
                      value={String(values[field.name] ?? "")}
                      onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
                    />
                  ) : field.type === "lines" || field.type === "ingredients" ? (
                    <Textarea
                      id={field.name}
                      value={String(values[field.name] ?? "")}
                      onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
                      className="min-h-32 font-mono text-xs"
                    />
                  ) : field.type === "select" ? (
                    <Select
                      id={field.name}
                      value={String(values[field.name] ?? "")}
                      onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
                    >
                      {(field.options ?? []).map((option) => (
                        <option key={option} value={option}>
                          {titleCase(option)}
                        </option>
                      ))}
                    </Select>
                  ) : field.type === "checkbox" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(values[field.name])}
                        onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.checked }))}
                      />
                      {field.label}
                    </label>
                  ) : (
                    <Input
                      id={field.name}
                      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                      step={field.type === "number" ? "0.01" : undefined}
                      value={String(values[field.name] ?? "")}
                      onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
                      required={field.required}
                    />
                  )}
                </Field>
              </div>
            ))}
          </div>
          {formError ? (
            <Alert tone="danger" title="Could not save">
              {formError}
            </Alert>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete this ${config!.singular}?`}
        description="This action is recorded in the audit log."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export { toNum };
