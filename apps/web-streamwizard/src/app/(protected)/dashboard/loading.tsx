import { Skeleton } from "@repo/ui";

export default function Loading() {
  return <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center gap-8">
    <Skeleton className="h-16 w-16 rounded-2xl border border-white/[0.08] bg-white/[0.02]" />
    <Skeleton className="h-8 w-32" />
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-4 w-24" />
    </div>
}
