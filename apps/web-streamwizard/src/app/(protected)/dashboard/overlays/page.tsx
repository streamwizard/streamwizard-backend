import { getOverlayScenes } from "@/actions/overlays/scenes";
import { getOverlayTemplates } from "@/actions/overlays/templates";
import { OverlayScenesList } from "@/components/overlays/editor/overlay-scenes-list";
import { redirect } from "next/navigation";
import { createClient } from "@repo/supabase/next/server";

export default async function OverlaysPage() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user?.user) redirect("/login");

  const [{ data: scenes, error }, { data: templates }] = await Promise.all([
    getOverlayScenes(),
    getOverlayTemplates(),
  ]);

  if (error) {
    return (
      <div className="text-destructive">
        Failed to load overlays: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overlays</h1>
        <p className="text-muted-foreground">
          Create and manage your stream overlays. Add them as browser sources in OBS.
        </p>
      </div>
      <div className="md:hidden rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400">
        Overlays need a bigger screen to build. Switch to desktop to create or edit them. You can still turn them on and off here. Mobile support is on the way.
      </div>
      <OverlayScenesList
        scenes={scenes ?? []}
        templates={(templates ?? []).map((t) => ({
          slug: t.slug,
          name: t.name,
          description: t.description,
          render_mode: t.render_mode,
        }))}
      />
    </div>
  );
}
