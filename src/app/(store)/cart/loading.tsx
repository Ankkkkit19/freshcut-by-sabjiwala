import { Card, Skeleton } from "@/components/ui";

export default function CartLoading() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <div className="flex gap-3">
              <Skeleton className="h-20 w-20 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-28 rounded-full" />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-10 w-full rounded-full" />
        </div>
      </Card>
    </div>
  );
}
