import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { desc, eq } from "drizzle-orm";
import { deliveryZones } from "@/db/schema";
import { getProductBySlug } from "@/server/catalog";
import { getStoreSettings } from "@/server/settings";
import { ProductBuyBox, ProductGallery } from "@/components/product-buy-box";
import { ProductCard, ProductGrid } from "@/components/product-card";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: `${product.name} — buy online fresh`,
    description:
      product.shortDescription ??
      `Buy ${product.name} online at FreshCut with live prices, real MRP and ${product.variants.length} pack sizes.`,
    openGraph: {
      title: `${product.name} | FreshCut`,
      description: product.shortDescription ?? undefined,
      images: product.images.slice(0, 1),
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [product, settings, zones] = await Promise.all([
    getProductBySlug(slug),
    getStoreSettings(),
    db
      .select({
        area: deliveryZones.area,
        city: deliveryZones.city,
        pincode: deliveryZones.pincode,
        etaMinutes: deliveryZones.etaMinutes,
        minOrderValue: deliveryZones.minOrderValue,
        freeDeliveryThreshold: deliveryZones.freeDeliveryThreshold,
      })
      .from(deliveryZones)
      .where(eq(deliveryZones.isActive, true))
      .orderBy(desc(deliveryZones.etaMinutes))
      .limit(6),
  ]);
  if (!product) notFound();

  const primaryZone = zones[0];
  const eta = primaryZone?.etaMinutes ?? 45;

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-[11px] text-neutral-500">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span aria-hidden> / </span>
        {product.categorySlug ? (
          <>
            <Link href={`/products?category=${product.categorySlug}`} className="hover:underline">
              {product.categoryName}
            </Link>
            <span aria-hidden> / </span>
          </>
        ) : null}
        <span className="text-brand-700">{product.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProductGallery images={product.images} name={product.name} />
        <ProductBuyBox
          product={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            shortDescription: product.shortDescription,
            variants: product.variants,
          }}
          preparationTypes={product.preparationTypes}
          freeDeliveryThreshold={Number(primaryZone?.freeDeliveryThreshold ?? settings.freeDeliveryThreshold)}
          minOrderValue={Number(primaryZone?.minOrderValue ?? settings.minOrderValue)}
          etaMinutes={eta}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-base font-semibold text-ink">Product information</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            {product.description ??
              `${product.name} is sourced fresh each morning and packed in food-grade crates for delivery.`}
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Category</dt>
              <dd className="text-sm font-medium text-ink">{product.categoryName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Pack sizes</dt>
              <dd className="text-sm font-medium text-ink">
                {product.variants.map((v) => v.label).join(", ")}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Storage</dt>
              <dd className="text-sm font-medium text-ink">Refrigerate at 4°C in the supplied pack</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-neutral-500">Shelf life</dt>
              <dd className="text-sm font-medium text-ink">Best within 48 hours of delivery</dd>
            </div>
          </dl>
          {product.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
          {product.aliases.length > 0 ? (
            <p className="mt-3 text-[11px] text-neutral-500">
              Also searched as: {product.aliases.join(", ")}
            </p>
          ) : null}
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-ink">Delivery information</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Delivery fee, minimum order and ETA come from the database delivery zones for your pincode.
          </p>
          <ul className="mt-3 space-y-2 text-xs">
            {zones.map((zone) => (
              <li key={`${zone.pincode}-${zone.area}`} className="flex items-center justify-between gap-2">
                <span className="text-neutral-600">
                  {zone.area}, {zone.pincode}
                </span>
                <span className="font-medium text-brand-700">{zone.etaMinutes} min</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-neutral-500">
            Free delivery above ₹{Number(primaryZone?.freeDeliveryThreshold ?? settings.freeDeliveryThreshold)} for
            these areas. Platform-wide minimum order ₹{settings.minOrderValue}.
          </p>
        </Card>
      </div>

      {product.related.length > 0 ? (
        <section aria-labelledby="related-heading">
          <h2 id="related-heading" className="mb-3 text-lg font-semibold text-ink">
            You may also like
          </h2>
          <ProductGrid>
            {product.related.map((item) => (
              <ProductCard key={item.id} product={item} compact />
            ))}
          </ProductGrid>
        </section>
      ) : null}
    </div>
  );
}
