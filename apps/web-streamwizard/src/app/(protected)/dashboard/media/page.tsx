import { redirect } from "next/navigation";
import { createClient } from "@repo/supabase/next/server";
import { listAssets } from "@/actions/assets";
import { MediaLibrary } from "@/components/media/media-library";

export default async function MediaPage() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user?.user) redirect("/login");

  const { data: listing } = await listAssets();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Media</h1>
        <p className="text-muted-foreground">
          Your alert images, sounds, and videos. Upload once, use them in any overlay or widget.
        </p>
      </div>
      <MediaLibrary initialListing={listing} />
    </div>
  );
}
