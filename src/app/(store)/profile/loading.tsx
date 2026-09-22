import { Card, Skeleton } from "@/components/ui";

export default function ProfileLoading() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      {Array.from({ length: 2 }).map((_, column) => (
        <Card key={column}>
          <div className="space-y-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-32 rounded-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}
