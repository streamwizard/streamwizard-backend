import {
  Bell,
  BellRing,
  Cloud,
  Cpu,
  Database,
  Globe,
  History,
  LayoutDashboard,
  LayoutList,
  MonitorDot,
  Network,
  Package,
  Radio,
  Server,
  SlidersHorizontal,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Parent pages (e.g. /ws) match exactly; child pages match by prefix so
   * dynamic segments like /ws/topology/[roomId] keep their item active. */
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/overview", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Traffic",
    items: [
      { href: "/http", label: "HTTP / API", icon: Globe },
      { href: "/eventsub", label: "EventSub", icon: Zap },
    ],
  },
  {
    label: "Realtime",
    items: [
      { href: "/ws", label: "WS Metrics", icon: Radio, exact: true },
      { href: "/ws/live", label: "WS Live", icon: MonitorDot },
      { href: "/ws/rooms", label: "Rooms", icon: LayoutList },
      { href: "/ws/topology", label: "Topology", icon: Network },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/database", label: "Database", icon: Database },
      { href: "/supabase", label: "Supabase", icon: Cloud },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { href: "/obs", label: "OBS Nodes", icon: Cpu },
      { href: "/ingest", label: "Ingest Servers", icon: Server },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/subscriptions", label: "Subscriptions", icon: Users },
      { href: "/widget-library", label: "Widget Review", icon: Package },
    ],
  },
  {
    label: "Alerts",
    items: [
      { href: "/alerts", label: "Active", icon: Bell, exact: true },
      { href: "/alerts/history", label: "History", icon: History },
      { href: "/alerts/rules", label: "Rules", icon: SlidersHorizontal },
      { href: "/alerts/notifications", label: "Notifications", icon: BellRing },
    ],
  },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Group + item for the current path, longest href match wins — drives the
 * header breadcrumb. */
export function findNavLocation(pathname: string): { group: NavGroup; item: NavItem } | null {
  let best: { group: NavGroup; item: NavItem } | null = null;
  for (const group of navGroups) {
    for (const item of group.items) {
      if (!isNavItemActive(item, pathname)) continue;
      if (!best || item.href.length > best.item.href.length) best = { group, item };
    }
  }
  return best;
}
