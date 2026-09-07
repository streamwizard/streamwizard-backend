import { Skeleton } from "@repo/ui";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-24 mt-1" />
      </div>
      <Skeleton className="h-[600px] w-full rounded-lg" />
    </div>
  );
}
