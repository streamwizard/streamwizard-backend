import { AppSidebar } from "@/components/nav/sidebar-app";
import { DashboardFrame } from "@/components/dashboard-frame";
import { SidebarProvider } from "@repo/ui";
import { createClient } from "@repo/supabase/next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { ClipFolderProvider } from "@/providers/clips-provider";
import { ModalProvider } from "@/providers/modal-provider";
import { ClipFolderDialogProvider } from "@/providers/clip-folder-dialog-provider";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
import { redirect } from "next/navigation";
import { getClipFolders } from "@repo/supabase/queries/clips";
import { getUserPreferences, getDiscordUserIdByUserIdMaybe } from "@repo/supabase/queries/user";
import { getGuildSettings } from "@repo/supabase/queries/discord";
import { getGuildMemberRoleIds } from "@/server/discord/roles";
import { env } from "@/lib/env";

export default async function layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.log(error);
    redirect("/login");
  }

  if (!data || !data.user) {
    redirect("/login");
  }

  const { data: folders } = await getClipFolders(supabase, data.user.id);
  const { count: clipCount } = await supabase
    .from("clips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", data.user.id);

  // Only checked while onboarding is still in progress — avoids an extra
  // Discord REST call on every dashboard page load for everyone past it.
  let discordStatus: "verified" | "not_member" | "not_linked" = "not_linked";
  const prefs = await getUserPreferences(supabase);
  if (!prefs?.onboarding_completed) {
    const discordUserId = await getDiscordUserIdByUserIdMaybe(supabase, data.user.id);
    if (discordUserId) {
      const [settings, roleIds] = await Promise.all([
        getGuildSettings(supabaseAdmin, env.DISCORD_GUILD_ID),
        getGuildMemberRoleIds(discordUserId),
      ]);
      discordStatus =
        roleIds && settings?.verified_role_id && roleIds.includes(settings.verified_role_id) ? "verified" : "not_member";
    }
  }

  const { data: hasCloudObsAccess } = await supabase.rpc("check_product_access", {
    p_product_id: "cloud_obs",
  });

  return (
    <SidebarProvider>
      <OnboardingModal
        clipCount={clipCount ?? 0}
        discordStatus={discordStatus}
        initialOnboardingCompleted={!!prefs?.onboarding_completed}
      />
      <ClipFolderProvider ClipFolders={folders || []}>
        <ModalProvider>
          <ClipFolderDialogProvider>
            <AppSidebar
              user={data.user}
              folders={folders || []}
              hasCloudObsAccess={!!hasCloudObsAccess}
              variant="inset"
            />
            <DashboardFrame>{children}</DashboardFrame>
          </ClipFolderDialogProvider>
        </ModalProvider>
      </ClipFolderProvider>
    </SidebarProvider>
  );
}
