import type { Metadata } from "next";
import { CatalogListing, type ListingSearchParams } from "@/components/catalog-listing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "All fresh groceries",
  description:
    "Browse every FreshCut product — vegetables, fruits, leafy greens, ready-to-cook cut packs, salads and dairy with real prices and live stock.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<ListingSearchParams>;
}) {
  const params = await searchParams;
  return (
    <CatalogListing
      basePath="/products"
      searchParams={params}
      heading={params.q ? `Search results for “${params.q}”` : "All fresh groceries"}
      description="Whole produce, ready-to-cook packs, salads and dairy. Live stock, honest MRP, delivered in slots."
    />
  );
}
