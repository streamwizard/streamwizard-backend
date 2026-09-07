import {
  BarChart3,
  Film,
  Layers,
  MessageCircle,
  Radio,
  Scissors,
  Signpost,
  Users,
  type LucideIcon,
} from "lucide-react";
import { productLinks } from "@/lib/constant";

export interface NavItem {
  name: string;
  href: string;
  /** Stable analytics id, matching the one the footer already sends. */
  cta: string;
  icon: LucideIcon;
  /** One line, drawn from the page's own hero so the nav can't oversell it. */
  description: string;
}

/*
 * The five public product pages. The header renders this twice (desktop
 * dropdown and mobile sheet) and the footer could take it too, so the list
 * lives here rather than inside either component.
 */
export const productNavItems: NavItem[] = [
  {
    name: "Cloud OBS",
    href: productLinks.cloudObs,
    cta: "cloud_obs",
    icon: Radio,
    description: "A dedicated OBS in the cloud, run from the deck on your phone.",
  },
  {
    name: "Overlays",
    href: productLinks.overlays,
    cta: "overlays",
    icon: Layers,
    description: "Alerts, chat, labels and IRL widgets in one browser source.",
  },
  {
    name: "Clips",
    href: productLinks.clips,
    cta: "clips",
    icon: Scissors,
    description: "Every clip from your channel, synced and filed in folders you name.",
  },
  {
    name: "VOD clipping",
    href: productLinks.vods,
    cta: "vods",
    icon: Film,
    description: "Cut the moment nobody clipped straight out of the VOD.",
  },
  {
    name: "Analytics",
    href: productLinks.analytics,
    cta: "analytics",
    icon: BarChart3,
    description: "Your last broadcast, minute by minute.",
  },
];

/**
 * Legal pages. The footer carries these too, but on mobile the footer is a long
 * scroll away, so the sheet repeats them.
 */
export const legalNavItems = [
  { name: "Terms of Service", href: "/terms-of-service" },
  { name: "Privacy Policy", href: "/privacy-policy" },
] as const;

/*
 * The pages about the project rather than the product. Same shape as the
 * product list, so the header renders both through one code path.
 */
export const companyNavItems: NavItem[] = [
  {
    name: "About",
    href: "/about",
    cta: "about",
    icon: Users,
    description: "Who builds it, why it started, and where it runs.",
  },
  {
    name: "Contact",
    href: "/contact",
    cta: "contact",
    icon: MessageCircle,
    description: "Discord for questions, GitHub for bugs.",
  },
  {
    name: "Roadmap",
    href: "/roadmap",
    cta: "roadmap",
    icon: Signpost,
    description: "What ships today and what is being worked on.",
  },
];
