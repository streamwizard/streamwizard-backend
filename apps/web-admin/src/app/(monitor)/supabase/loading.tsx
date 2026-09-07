import { PageSkeleton } from "@/components/widgets/page-skeleton";

export default function Loading() {
  return <PageSkeleton statCards={5} blocks={2} />;
}
