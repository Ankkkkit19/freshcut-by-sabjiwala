"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { PRODUCT_TYPES, slugify, titleCase } from "@/lib/utils";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  Table,
  Td,
  Textarea,
  Th,
  useToast,
} from "@/components/ui";

type VariantForm = {
  id?: number;
  label: string;
  unit: "KG" | "G" | "PIECE" | "PACKET" | "BOX" | "BUNCH" | "LITRE";
  price: number;
  mrp: number | null;
  stock: number;
  weightInGrams: number | null;
  yieldRatio: number | null;
  isActive: boolean;
  isDefault: boolean;
};

type ProductForm = {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  categoryId: number | null;
  productType: string;
  images: string;
  tags: string;
  aliases: string;
  preparationTypes: string;
  isActive: boolean;
  isFeatured: boolean;
  variants: VariantForm[];
};

const EMPTY_VARIANT: VariantForm = {
  label: "1 kg",
  unit: "KG",
  price: 0,
  mrp: null,
  stock: 0,
  weightInGrams: 1000,
  yieldRatio: null,
  isActive: true,
  isDefault: true,
};

const UNITS = ["KG", "G", "PIECE", "PACKET", "BOX", "BUNCH", "LITRE"] as const;

export function ProductEditor({
  productId,
  initial,
}: {
  productId?: number;
  initial?: {
    name: string;
    slug: string;
    shortDescription: string | null;
    description: string | null;
    categoryId: number | null;
    productType: string;
    images: string[];
    tags: string[];
    aliases: string[];
    preparationTypes: string[];
    isActive: boolean;
    isFeatured: boolean;
    variants: {
      id: number;
      label: string;
      unit: string;
      price: string;
      mrp: string | null;
      stock: string;
      weightInGrams: number | null;
      yieldRatio: string | null;
      isActive: boolean;
      isDefault: boolean;
    }[];
  };
}) {
  const router = useRouter();
  const { push } = useToast();
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    shortDescription: initial?.shortDescription ?? "",
    description: initial?.description ?? "",
    categoryId: initial?.categoryId ?? null,
    productType: initial?.productType ?? "VEGETABLE",
    images: (initial?.images ?? []).join("\n"),
    tags: (initial?.tags ?? []).join(", "),
    aliases: (initial?.aliases ?? []).join(", "),
    preparationTypes: (initial?.preparationTypes ?? []).join(", "),
    isActive: initial?.isActive ?? true,
    isFeatured: initial?.isFeatured ?? false,
    variants:
      initial?.variants.map((variant) => ({
        id: variant.id,
        label: variant.label,
        unit: variant.unit as VariantForm["unit"],
        price: Number(variant.price),
        mrp: variant.mrp ? Number(variant.mrp) : null,
        stock: Number(variant.stock),
        weightInGrams: variant.weightInGrams,
        yieldRatio: variant.yieldRatio ? Number(variant.yieldRatio) : null,
        isActive: variant.isActive,
        isDefault: variant.isDefault,
      })) ?? [{ ...EMPTY_VARIANT }],
  });

  useEffect(() => {
    apiFetch<{ items: { id: number; name: string }[] }>("/api/admin/resource/categories")
      .then((data) => setCategories(data.items))
      .catch(() => setCategories([]));
  }, []);

  function update<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateVariant(index: number, patch: Partial<VariantForm>) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)),
    }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      slug: form.slug || slugify(form.name),
      shortDescription: form.shortDescription,
      description: form.description,
      categoryId: form.categoryId,
      productType: form.productType,
      images: form.images
        .split("\n")
        .map((image) => image.trim())
        .filter(Boolean),
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      aliases: form.aliases.split(",").map((alias) => alias.trim()).filter(Boolean),
      preparationTypes: form.preparationTypes.split(",").map((p) => p.trim().toUpperCase()).filter(Boolean),
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      variants: form.variants.map((variant, index) => ({
        ...variant,
        sortOrder: index,
        sku: undefined,
      })),
    };
    try {
      if (productId) {
        await apiFetch(`/api/admin/products/${productId}`, { method: "PATCH", json: payload });
        push("Product updated", "success");
      } else {
        await apiFetch("/api/admin/products", { method: "POST", json: payload });
        push("Product created", "success");
      }
      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <nav aria-label="Breadcrumb" className="text-[11px] text-neutral-500">
            <Link href="/admin/products" className="hover:underline">
              Products
            </Link>
            <span aria-hidden> / </span>
            <span className="text-brand-700">{productId ? "Edit" : "New"}</span>
          </nav>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">
            {productId ? `Edit ${form.name}` : "Create a product"}
          </h1>
          <p className="text-sm text-neutral-600">
            MRP is optional and must be a real pack MRP — it is never auto-generated.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/products">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" loading={saving}>
            <Save className="h-4 w-4" /> {productId ? "Save changes" : "Create product"}
          </Button>
        </div>
      </header>

      {error ? <Alert tone="danger" title="Could not save">{error}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="space-y-3">
          <h2 className="text-base font-semibold text-ink">Product details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="name">
              <Input
                id="name"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                required
                minLength={2}
              />
            </Field>
            <Field label="Slug" htmlFor="slug" hint="Leave blank to generate from the name.">
              <Input
                id="slug"
                value={form.slug}
                onChange={(event) => update("slug", event.target.value)}
                placeholder="potato"
              />
            </Field>
            <Field label="Category" htmlFor="category">
              <Select
                id="category"
                value={form.categoryId ?? ""}
                onChange={(event) => update("categoryId", event.target.value ? Number(event.target.value) : null)}
              >
                <option value="">Uncategorised</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Product type" htmlFor="productType">
              <Select
                id="productType"
                value={form.productType}
                onChange={(event) => update("productType", event.target.value)}
              >
                {PRODUCT_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {titleCase(option)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Short description" htmlFor="shortDescription" hint="Shown on product cards (max ~120 chars).">
            <Input
              id="shortDescription"
              value={form.shortDescription}
              onChange={(event) => update("shortDescription", event.target.value)}
            />
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea
              id="description"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </Field>
          <Field label="Images" htmlFor="images" hint="One image URL per line. First image is the card image.">
            <Textarea id="images" value={form.images} onChange={(event) => update("images", event.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Tags" htmlFor="tags" hint="Comma separated">
              <Input id="tags" value={form.tags} onChange={(event) => update("tags", event.target.value)} />
            </Field>
            <Field label="Aliases" htmlFor="aliases" hint="Hindi names, comma separated">
              <Input id="aliases" value={form.aliases} onChange={(event) => update("aliases", event.target.value)} />
            </Field>
            <Field label="Preparation types" htmlFor="preparations" hint="e.g. CUBED, SLICED, GRATED">
              <Input
                id="preparations"
                value={form.preparationTypes}
                onChange={(event) => update("preparationTypes", event.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-base font-semibold text-ink">Visibility</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => update("isActive", event.target.checked)}
            />
            Active (visible on storefront)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(event) => update("isFeatured", event.target.checked)}
            />
            Featured on homepage
          </label>
          <p className="text-[11px] text-neutral-500">
            Changing stock here writes an ADJUSTMENT transaction to the inventory ledger so every change is
            auditable.
          </p>
          <div className="rounded-xl bg-brand-50/60 p-3 text-[11px] text-brand-900">
            <p className="font-semibold">Prepared product yield</p>
            <p className="mt-1">
              For ready-to-cook packs set a yield ratio (e.g. 0.75 = 10 kg raw produces 7.5 kg usable). Raw and
              prepared stock are tracked separately in Inventory.
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">Variants (pack sizes)</h2>
            <p className="text-xs text-neutral-500">Each cart and order line references the exact variant.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => update("variants", [...form.variants, { ...EMPTY_VARIANT, isDefault: false }])}
          >
            <Plus className="h-4 w-4" /> Add variant
          </Button>
        </div>

        <div className="pt-3">
          <Table>
            <thead>
              <tr>
                <Th>Label</Th>
                <Th>Unit</Th>
                <Th>Weight (g)</Th>
                <Th>Price ₹</Th>
                <Th>MRP ₹</Th>
                <Th>Stock</Th>
                <Th>Yield</Th>
                <Th>Active</Th>
                <Th>Default</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {form.variants.map((variant, index) => (
                <tr key={variant.id ?? `new-${index}`}>
                  <Td>
                    <Input
                      aria-label={`Variant ${index + 1} label`}
                      value={variant.label}
                      onChange={(event) => updateVariant(index, { label: event.target.value })}
                      className="h-8 w-28"
                      required
                    />
                  </Td>
                  <Td>
                    <Select
                      aria-label={`Variant ${index + 1} unit`}
                      value={variant.unit}
                      onChange={(event) => updateVariant(index, { unit: event.target.value as VariantForm["unit"] })}
                      className="h-8 w-24"
                    >
                      {UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit.toLowerCase()}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <Input
                      aria-label={`Variant ${index + 1} weight`}
                      type="number"
                      value={variant.weightInGrams ?? ""}
                      onChange={(event) =>
                        updateVariant(index, { weightInGrams: event.target.value ? Number(event.target.value) : null })
                      }
                      className="h-8 w-24"
                    />
                  </Td>
                  <Td>
                    <Input
                      aria-label={`Variant ${index + 1} price`}
                      type="number"
                      step="0.01"
                      value={variant.price}
                      onChange={(event) => updateVariant(index, { price: Number(event.target.value) })}
                      className="h-8 w-24"
                      required
                    />
                  </Td>
                  <Td>
                    <Input
                      aria-label={`Variant ${index + 1} MRP`}
                      type="number"
                      step="0.01"
                      value={variant.mrp ?? ""}
                      onChange={(event) =>
                        updateVariant(index, { mrp: event.target.value ? Number(event.target.value) : null })
                      }
                      className="h-8 w-24"
                    />
                  </Td>
                  <Td>
                    <Input
                      aria-label={`Variant ${index + 1} stock`}
                      type="number"
                      step="0.001"
                      value={variant.stock}
                      onChange={(event) => updateVariant(index, { stock: Number(event.target.value) })}
                      className="h-8 w-24"
                    />
                  </Td>
                  <Td>
                    <Input
                      aria-label={`Variant ${index + 1} yield ratio`}
                      type="number"
                      step="0.01"
                      value={variant.yieldRatio ?? ""}
                      onChange={(event) =>
                        updateVariant(index, { yieldRatio: event.target.value ? Number(event.target.value) : null })
                      }
                      className="h-8 w-20"
                    />
                  </Td>
                  <Td>
                    <input
                      type="checkbox"
                      aria-label={`Variant ${index + 1} active`}
                      checked={variant.isActive}
                      onChange={(event) => updateVariant(index, { isActive: event.target.checked })}
                    />
                  </Td>
                  <Td>
                    <input
                      type="radio"
                      name="default-variant"
                      aria-label={`Variant ${index + 1} is default`}
                      checked={variant.isDefault}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          variants: prev.variants.map((v, i) => ({ ...v, isDefault: i === index })),
                        }))
                      }
                    />
                  </Td>
                  <Td>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove variant ${index + 1}`}
                      onClick={() =>
                        update(
                          "variants",
                          form.variants.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        {form.variants.length === 0 ? (
          <p className="mt-3 text-xs text-neutral-500">At least one variant is required.</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{form.variants.length} variant(s)</Badge>
          {form.variants.some((variant) => variant.mrp && variant.mrp < variant.price) ? (
            <Badge tone="warn">MRP lower than price on some variants</Badge>
          ) : null}
        </div>
      </Card>
    </form>
  );
}
