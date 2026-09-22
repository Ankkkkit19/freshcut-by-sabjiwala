import { Card, Skeleton } from "@/components/ui";

export default function AdminAnalyticsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-44" />
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <Skeleton className="h-52" />
        </Card>
        <Card>
          <Skeleton className="h-52" />
        </Card>
      </div>
    </div>
  );
}
