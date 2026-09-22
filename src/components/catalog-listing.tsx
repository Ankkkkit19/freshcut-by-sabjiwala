import Link from "next/link";
import { ShoppingBasket } from "lucide-react";
import { listCategories, listProducts, type CatalogQuery } from "@/server/catalog";
import { ProductCard, ProductGrid } from "@/components/product-card";
import { EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

const SORTS = [
  { key: "popular", label: "Popular" },
  { key: "newest", label: "Newest" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
] as const;

export type ListingSearchParams = {
  category?: string;
  sort?: string;
  page?: string;
  q?: string;
};

function buildHref(base: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

/**
 * Server-rendered catalogue listing: filters and pagination are real URLs so the
 * list is crawlable, shareable and never loads the whole catalogue at once.
 */
export async function CatalogListing({
  basePath,
  searchParams,
  fixedQuery,
  heading,
  description,
}: {
  basePath: string;
  searchParams: ListingSearchParams;
  fixedQuery?: Partial<CatalogQuery>;
  heading: string;
  description: string;
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const sort = (SORTS.find((s) => s.key === searchParams.sort)?.key ?? "popular") as
    | "popular"
    | "newest"
    | "price-asc"
    | "price-desc";

  const [result, categories] = await Promise.all([
    listProducts({
      ...fixedQuery,
      q: searchParams.q ?? fixedQuery?.q ?? null,
      categorySlug: fixedQuery?.categorySlug ?? searchParams.category ?? null,
      sort,
      page,
      pageSize: 12,
    }),
    listCategories(),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const activeCategory =
    fixedQuery?.categorySlug ?? searchParams.category ?? undefined;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <nav aria-label="Breadcrumb" className="text-[11px] text-neutral-500">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span aria-hidden> / </span>
          <span className="text-brand-700">{heading}</span>
        </nav>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{heading}</h1>
        <p className="text-sm text-neutral-600">{description}</p>
      </header>

      {!fixedQuery?.categorySlug ? (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Link
            href={buildHref(basePath, { sort: searchParams.sort, q: searchParams.q })}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
              !activeCategory
                ? "border-brand-500 bg-brand-50 text-brand-800"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-brand-300",
            )}
          >
            All
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={buildHref(basePath, {
                category: category.slug,
                sort: searchParams.sort,
                q: searchParams.q,
              })}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                activeCategory === category.slug
                  ? "border-brand-500 bg-brand-50 text-brand-800"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-brand-300",
              )}
            >
              {category.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-500">
          {result.total} product{result.total === 1 ? "" : "s"}
          {searchParams.q ? ` for “${searchParams.q}”` : ""}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SORTS.map((option) => (
            <Link
              key={option.key}
              href={buildHref(basePath, {
                category: activeCategory,
                q: searchParams.q,
                sort: option.key === "popular" ? undefined : option.key,
              })}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                sort === option.key
                  ? "border-brand-500 bg-brand-50 text-brand-800"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-brand-300",
              )}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBasket className="h-7 w-7" />}
          title="No products found."
          description="Try another category or clear your filters."
          action={
            <Link
              href={basePath}
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Reset filters
            </Link>
          }
        />
      ) : (
        <ProductGrid>
          {result.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </ProductGrid>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-2 pt-2">
          {Array.from({ length: totalPages }).map((_, index) => {
            const pageNumber = index + 1;
            return (
              <Link
                key={pageNumber}
                href={buildHref(basePath, {
                  category: activeCategory,
                  q: searchParams.q,
                  sort: searchParams.sort,
                  page: pageNumber === 1 ? undefined : String(pageNumber),
                })}
                aria-current={pageNumber === page ? "page" : undefined}
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full border text-sm",
                  pageNumber === page
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-brand-300",
                )}
              >
                {pageNumber}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
