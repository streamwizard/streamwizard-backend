import { requireProductAccess } from "@/lib/require-product-access";
import { listIngestKeys } from "@/actions/ingest-keys";
import { getAutoSwitcherConfig } from "@/actions/supabase/auto-switcher";
import { createAdminClient } from "@repo/supabase/next/admin";
import { getActiveIngestNodeHosts } from "@repo/supabase/queries/ingest-nodes";
import { CloudObsContent } from "@/components/irl/cloud-obs/cloud-obs-content";

export default async function CloudObsPage() {
  const access = await requireProductAccess("cloud_obs");
  const [{ data: keys }, autoSwitcherConfig, nodeHosts] = await Promise.all([
    listIngestKeys(),
    getAutoSwitcherConfig(),
    getActiveIngestNodeHosts(createAdminClient()),
  ]);

  // The cloud OBS instance pulls the incoming feed back over the tailnet. This
  // comes from the linked ingest node, falling back to env/placeholder only
  // when no node is linked (e.g. local dev). Key management (and the public
  // push host) now lives on /dashboard/irl/ingest.
  const obsPullHost = nodeHosts?.tailscale_ip ?? process.env.NEXT_PUBLIC_OBS_PULL_HOST ?? "your-ingest-tailscale-ip";

  return (
    <CloudObsContent
      canInteract={access.canInteract}
      plan={access.plan}
      initialIngestKeys={keys ?? []}
      obsPullHost={obsPullHost}
      autoSwitcherConfig={autoSwitcherConfig}
    />
  );
}
