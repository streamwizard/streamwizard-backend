import { getOverlayScene } from "@/actions/overlays/scenes";
import { getWidgetsByIds } from "@/actions/widgets";
import { OverlayEditor } from "@/components/overlays/editor/overlay-editor";
import { createClient } from "@repo/supabase/next/server";
import { redirect } from "next/navigation";
import { getClipFolders } from "@repo/supabase/queries/clips";
import { asCustomWidgetConfig } from "@/types/overlays";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OverlayEditorPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user?.user) redirect("/login");

  const { data: scene, error } = await getOverlayScene(id);

  if (error || !scene) {
    redirect("/dashboard/overlays");
  }

  // Widget rows the scene's custom widgets need, fetched alongside the scene so
  // the canvas renders them on first paint instead of one request per item.
  const widgetIds = scene.items
    .filter((item) => item.type === "custom_widget")
    .map((item) => asCustomWidgetConfig(item.config).widget_id)
    .filter(Boolean);

  const [{ data: folders }, { data: widgets }] = await Promise.all([
    getClipFolders(supabase, user.user.id),
    getWidgetsByIds(widgetIds),
  ]);

  return (
    <OverlayEditor
      initialScene={scene}
      clipFolders={folders ?? []}
      initialWidgets={widgets ?? []}
    />
  );
}
