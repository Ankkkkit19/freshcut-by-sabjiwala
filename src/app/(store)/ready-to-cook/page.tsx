import type { Metadata } from "next";
import { CatalogListing, type ListingSearchParams } from "@/components/catalog-listing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ready to cook",
  description:
    "Chopped onion, diced tomato, grated carrot, sabzi mixes and salad packs cut fresh in the FreshCut kitchen. No chopping, no waste.",
};

export default async function ReadyToCookPage({
  searchParams,
}: {
  searchParams: Promise<ListingSearchParams>;
}) {
  const params = await searchParams;
  return (
    <CatalogListing
      basePath="/ready-to-cook"
      searchParams={params}
      fixedQuery={{ readyToCook: true }}
      heading="Ready to Cook"
      description="Cut, grated and portioned the same morning. Every pack tracks raw-to-prepared yield so you pay only for usable product."
    />
  );
}
