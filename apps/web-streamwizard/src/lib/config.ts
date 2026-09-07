import { DashboardConfig } from "@/types/sidebar";

import { Blocks, Clapperboard, ToggleRight, User, UserX } from "lucide-react";
export const dashboardConfig: DashboardConfig = {
  overview: {
    routes: [
      {
        label: "Clip Overview",
        href: "/dashboard/",
        icon: Clapperboard,
        beta: true,
        subRoutes: [
          {
            label: "Twitch",
            href: "/dashboard/clips/favorites",
            icon: Clapperboard,
            beta: true,
          },
        ]
      },
    ],
  },
  // twitch: {
  //   title: "Twitch",
  //   routes: [
  //     {
  //       label: "CLips",
  //       href: "/dashboard/clips/",
  //       icon: Clapperboard,
  //       beta: true,
  //     },
  //   ],
  // },

  // admin: {
  //   title: 'Admin',
  //   routes: [
  //     {
  //       label: 'Admin Panel',
  //       href: '/dashboard/admin',
  //       icon: AreaChart,
  //     },
  //     {
  //       label: 'Analytics',
  //       href: '/dashboard/analytics',
  //       icon: AreaChart,
  //     },
  //   ],
  // },
};

export const SettingsNavItems = [
  {
    label: "Account",
    href: "/dashboard/settings/account",
    icon: User,
  },
  {
    label: "Preferences",
    href: "/dashboard/settings/preferences",
    icon: ToggleRight,
  },
  {
    label: "Integrations",
    href: "/dashboard/settings/integrations",
    icon: Blocks,
  },
];
