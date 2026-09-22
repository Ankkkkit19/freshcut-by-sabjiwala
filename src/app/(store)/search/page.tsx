import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { listProducts } from "@/server/catalog";
import { ProductCard, ProductGrid } from "@/components/product-card";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Search: ${q}` : "Search fresh groceries",
    description: q
      ? `FreshCut search results for ${q}.`
      : "Search FreshCut for aloo, pyaz, tamatar, palak, paneer and more.",
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const term = (q ?? "").trim();
  const result = term
    ? await listProducts({ q: term, page: Math.max(1, Number(page ?? 1) || 1), pageSize: 12 })
    : { items: [], total: 0, page: 1, pageSize: 12 };

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <nav aria-label="Breadcrumb" className="text-[11px] text-neutral-500">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span aria-hidden> / </span>
          <span className="text-brand-700">Search</span>
        </nav>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">
          {term ? `Results for “${term}”` : "Search FreshCut"}
        </h1>
        {term ? (
          <p className="text-sm text-neutral-600">
            {result.total} match{result.total === 1 ? "" : "es"} found. Searches also match Hindi names like
            aloo, pyaz and tamatar.
          </p>
        ) : (
          <p className="text-sm text-neutral-600">
            Try searching for “aloo”, “pyaz”, “tamatar”, “palak”, “salad mix” or “paneer”.
          </p>
        )}
      </header>

      {term && result.items.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-7 w-7" />}
          title={`We couldn't find anything matching “${term}”.`}
          description="Try another search, or browse a category."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href="/vegetables"
                className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Shop vegetables
              </Link>
              <Link
                href="/products"
                className="rounded-full border border-brand-200 px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50"
              >
                Browse all products
              </Link>
            </div>
          }
        />
      ) : (
        <ProductGrid>
          {result.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </ProductGrid>
      )}
    </div>
  );
}
