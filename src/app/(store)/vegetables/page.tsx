import type { Metadata } from "next";
import { CatalogListing, type ListingSearchParams } from "@/components/catalog-listing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fresh vegetables",
  description:
    "Order fresh vegetables online — potato, tomato, onion, carrot, capsicum, cauliflower and more with transparent pack sizes and live prices.",
};

export default async function VegetablesPage({
  searchParams,
}: {
  searchParams: Promise<ListingSearchParams>;
}) {
  const params = await searchParams;
  return (
    <CatalogListing
      basePath="/vegetables"
      searchParams={params}
      fixedQuery={{ categorySlug: "vegetables" }}
      heading="Fresh vegetables"
      description="Sourced from Nashik, Ooty and Mahabaleshwar farms every morning. Choose the exact pack size you need."
    />
  );
}
