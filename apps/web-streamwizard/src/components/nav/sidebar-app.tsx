"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/ui";
import { discordInviteLink } from "@/lib/constant";
import { Database } from "@repo/supabase";
import { User } from "@supabase/supabase-js";
import { BarChart2, Cloud,FileVideoCamera, FolderOpen, Layers, Radio } from "lucide-react";
import { StreamWizardLogo } from "@/components/brand/streamwizard-logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaDiscord } from "react-icons/fa";
import { Separator } from "@repo/ui";
import { DashboardUserNav } from "./dashboard-user-nav";
import SidebarClips from "./sidebar-clips";
import SidebarCommands from "./sidebar-commands";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: User;
  folders: Database["public"]["Tables"]["clip_folders"]["Row"][];
  hasCloudObsAccess?: boolean;
}

export function AppSidebar({
  user,
  folders,
  hasCloudObsAccess = false,
  ...props
}: AppSidebarProps) {
  const { setOpenMobile, isMobile } = useSidebar();
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };
  const pathname = usePathname();

  return (
    <Sidebar className="h-full" {...props}>
      <SidebarHeader>
        <div className="flex flex-row items-center gap-2 px-4 mt-4 justify-center">
          <StreamWizardLogo
            width={160}
            height={160}
            style={{ width: 160, height: 160 }}
            priority
          />
        </div>
        <span className="my-4">
          <Separator />
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/dashboard"}>
                  <Link href="/dashboard" onClick={closeMobile}>
                    <BarChart2 className="mr-2 h-4 w-4" />
                    Stream Analytics
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Clips</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/dashboard/vods")}>
                  <Link href="/dashboard/vods" onClick={closeMobile}>
                    <FileVideoCamera className="mr-2 h-4 w-4" />
                    Vods
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarClips clipFolders={folders} />
          </SidebarGroupContent>
        </SidebarGroup>
        {hasCloudObsAccess && (
          <SidebarGroup>
            <SidebarGroupLabel>IRL</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/dashboard/irl/obs")}>
                    <Link href="/dashboard/irl/obs" onClick={closeMobile}>
                      <Cloud className="mr-2 h-4 w-4" />
                      Cloud OBS
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/dashboard/irl/ingest")}>
                    <Link href="/dashboard/irl/ingest" onClick={closeMobile}>
                      <Radio className="mr-2 h-4 w-4" />
                      Ingest
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Overlays</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={
                    pathname.startsWith("/dashboard/overlays") || pathname.startsWith("/dashboard/widgets")
                  }
                >
                  <Link href="/dashboard/overlays" onClick={closeMobile}>
                    <Layers className="mr-2 h-4 w-4" />
                    Overlay Editor
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/dashboard/media")}>
                  <Link href="/dashboard/media" onClick={closeMobile}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Media
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Commands</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarCommands />
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
      <SidebarFooter>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link
                href={discordInviteLink}
                target="_blank"
                className="items flex h-8 w-full select-none items-center justify-between rounded-md pl-3 pr-3 text-sm text-sidebar-foreground/80 transition hover:cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <div className="flex flex-row items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full ">
                    <FaDiscord className="h-4 w-4 text-[#002bff]" />
                  </div>
                  <p className="text-sm font-medium leading-none">Discord Community</p>
                </div>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <DashboardUserNav profile_img={user.user_metadata.avatar_url} username={user.user_metadata.full_name} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </SidebarFooter>
    </Sidebar>
  );
}
