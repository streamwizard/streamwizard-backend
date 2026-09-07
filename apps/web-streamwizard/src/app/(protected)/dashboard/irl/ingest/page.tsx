import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireProductAccess } from "@/lib/require-product-access";
import { listIngestKeys } from "@/actions/ingest-keys";
import { createAdminClient } from "@repo/supabase/next/admin";
import { getActiveIngestNodeHosts } from "@repo/supabase/queries/ingest-nodes";
import { IngestLiveStats } from "@/components/irl/ingest-live-stats";
import { IngestKeysSection } from "@/components/irl/ingest-keys-section";
import { FeatureDisabledBanner } from "@/components/ui/feature-disabled-banner";

export default async function IrlIngestPage() {
  const access = await requireProductAccess("cloud_obs");

  const [{ data: keys }, nodeHosts] = await Promise.all([
    listIngestKeys(),
    getActiveIngestNodeHosts(createAdminClient()),
  ]);

  // Encoders push to the linked node's public domain (when ops has set one) or
  // its public IP, falling back to env/placeholder only when no node is linked.
  const ingestHost =
    nodeHosts?.public_hostname ?? nodeHosts?.public_ip ?? process.env.NEXT_PUBLIC_INGEST_HOST ?? "your-stream-server";

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link
          href="/dashboard/irl/obs"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Cloud OBS
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Ingest keys</h1>
        <p className="text-muted-foreground text-sm">
          Push your IRL feed to StreamWizard over SRT or SRTLA. Grab your key and URLs below, and rotate the key the
          second it leaks.
        </p>
      </div>

      {!access.canInteract && <FeatureDisabledBanner />}

      <IngestLiveStats />

      <IngestKeysSection initialKeys={keys ?? []} ingestHost={ingestHost} canInteract={access.canInteract} />
    </div>
  );
}
