import { ProductCard, ProductCardSkeleton, ProductGrid } from "@/components/product-card";
import { Skeleton } from "@/components/ui";

export default function ProductsLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-64" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <ProductGrid>
        {Array.from({ length: 10 }).map((_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </ProductGrid>
    </div>
  );
}
