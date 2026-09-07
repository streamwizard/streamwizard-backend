import { createClient } from "@repo/supabase/next/server";
import { Lock } from "lucide-react";

const PRODUCT_LABELS: Record<string, string> = {
  cloud_obs: "Cloud OBS",
  ingest_server: "Ingest Server",
};

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ feature?: string }>;
}) {
  const { feature } = await searchParams;
  const supabase = await createClient();

  let productName = feature ? (PRODUCT_LABELS[feature] ?? feature) : null;

  if (feature && !productName) {
    const { data } = await supabase.from("products").select("name").eq("id", feature).maybeSingle();
    if (data) productName = data.name;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Lock className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl font-semibold">
          {productName ? `${productName} requires a subscription` : "Subscription required"}
        </h1>
        <p className="text-muted-foreground">
          This feature is part of a paid plan. Subscription management is coming soon — check back
          shortly or reach out if you need access.
        </p>
      </div>
    </div>
  );
}
