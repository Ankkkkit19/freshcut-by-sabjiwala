import type { Metadata } from "next";
import { CatalogListing, type ListingSearchParams } from "@/components/catalog-listing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fresh fruits",
  description:
    "Ripe, seasonal Indian fruits delivered fresh — mango, banana, apple, orange, grapes, pomegranate and papaya with live availability.",
};

export default async function FruitsPage({
  searchParams,
}: {
  searchParams: Promise<ListingSearchParams>;
}) {
  const params = await searchParams;
  return (
    <CatalogListing
      basePath="/fruits"
      searchParams={params}
      fixedQuery={{ categorySlug: "fruits" }}
      heading="Fresh fruits"
      description="Naturally ripened, never carbide-treated. Stored at the right temperature until your slot."
    />
  );
}
