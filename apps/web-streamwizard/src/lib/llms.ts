import {
  discordInviteLink,
  docsClipsLink,
  docsLink,
  githubLink,
  pricingLink,
  productLinks,
  twitchChannelLink,
} from "@/lib/constant";
import { absoluteUrl } from "@/lib/seo";

/**
 * Content of /llms.txt, the plain-text site index that ChatGPT, Perplexity and
 * Claude fetchers read (Google Search ignores it). Format follows llmstxt.org:
 * an H1, one blockquote summary, then H2 sections of `- [title](url): line`.
 *
 * Internal hrefs are site-relative and resolved through absoluteUrl() so the
 * file agrees with the sitemap on the canonical origin. Every internal path
 * must appear in PUBLIC_ROUTES; llms.test.ts enforces that so a noindexed page
 * such as /roadmap cannot be handed to an answer engine by accident.
 */
export type LlmsEntry = {
  title: string;
  /** Site-relative path or absolute external URL. */
  href: string;
  description: string;
};

export type LlmsSection = {
  heading: string;
  entries: LlmsEntry[];
};

/**
 * One paragraph an answer engine can quote as "what is StreamWizard". Same
 * facts as the /about description and the SoftwareApplication featureList, in
 * one breath. Cloud OBS is the paid tier, so the summary says so rather than
 * calling the whole product free.
 */
export const LLMS_SUMMARY =
  "StreamWizard is open source Twitch tooling built by one streamer in the Netherlands since 2024: " +
  "cloud OBS for IRL streaming (SRT or SRTLA ingest with an auto switcher that covers connection drops), " +
  "overlays and alerts in one browser source, a clip manager with folders, VOD clipping from a marked timeline, " +
  "and per-stream analytics, all behind one Twitch login. The code is MIT licensed. " +
  "Cloud OBS is the paid tier; the rest is free.";

export const LLMS_SECTIONS: LlmsSection[] = [
  {
    heading: "Product",
    entries: [
      {
        title: "Cloud OBS",
        href: productLinks.cloudObs,
        description:
          "A dedicated OBS for your channel in the cloud. Your phone streams in over SRT or SRTLA, " +
          "you run it from the deck on your phone, and an auto switcher swaps to a fallback scene when the " +
          "connection goes bad and posts the reason to chat.",
      },
      {
        title: "Overlays",
        href: productLinks.overlays,
        description:
          "Alerts, chat, clips rotator, countdowns and IRL widgets in a single OBS browser source, " +
          "with an editor for custom widgets.",
      },
      {
        title: "Clips",
        href: productLinks.clips,
        description:
          "Every Twitch clip from your channel synced automatically into nested folders, with stacking " +
          "filters by category, streamer and clipper, and portrait downloads.",
      },
      {
        title: "VOD clipping",
        href: productLinks.vods,
        description:
          "Follows, subs, cheers, raids and ad breaks marked on the VOD timeline. Drag a 5 to 60 second " +
          "selection and it becomes a real Twitch clip.",
      },
      {
        title: "Analytics",
        href: productLinks.analytics,
        description:
          "Per-stream viewer graph with follows, subs and clips plotted on it, plus a best hour summary.",
      },
      {
        title: "Pricing",
        href: pricingLink,
        description: "What the free tier includes and what Cloud OBS costs.",
      },
    ],
  },
  {
    heading: "Company",
    entries: [
      {
        title: "About",
        href: "/about",
        description:
          "Who builds StreamWizard and why: one streamer in the Netherlands, building in public since 2024.",
      },
      {
        title: "Contact",
        href: "/contact",
        description: "A Discord ticket is the fastest route to support. Bugs go to GitHub issues.",
      },
    ],
  },
  {
    heading: "Community",
    entries: [
      {
        title: "GitHub",
        href: githubLink,
        description: "Full source code, MIT licensed. Issues and pull requests welcome.",
      },
      {
        title: "Discord",
        href: discordInviteLink,
        description: "Support, bug reports and feature requests.",
      },
      {
        title: "Twitch",
        href: twitchChannelLink,
        description: "The founder's channel.",
      },
      {
        title: "Docs",
        href: docsLink,
        description: "Setup guides per feature.",
      },
      {
        title: "Docs index for AI",
        href: `${docsLink}/llms.txt`,
        description: "Machine-readable index of the documentation.",
      },
      {
        title: "IRL streaming docs",
        href: `${docsLink}/irl/overview`,
        description: "Cloud OBS, SRT and SRTLA ingest, the auto switcher and the deck.",
      },
      {
        title: "Overlay docs",
        href: `${docsLink}/overlays/overview`,
        description: "Overlay setup, alerts, the media library and the OBS browser source.",
      },
      {
        title: "Clip docs",
        href: docsClipsLink,
        description: "Clip sync, folders and filters.",
      },
      {
        title: "Widget docs",
        href: `${docsLink}/widgets/overview`,
        description: "Build custom overlay widgets.",
      },
    ],
  },
  {
    heading: "Optional",
    entries: [
      { title: "Privacy Policy", href: "/privacy-policy", description: "How StreamWizard handles data." },
      { title: "Terms of Service", href: "/terms-of-service", description: "Terms for using StreamWizard." },
    ],
  },
];

export function isInternalHref(href: string): boolean {
  return href.startsWith("/");
}

export function resolveLlmsHref(href: string): string {
  return isInternalHref(href) ? absoluteUrl(href) : href;
}

export function renderLlmsTxt(): string {
  const lines: string[] = ["# StreamWizard", "", `> ${LLMS_SUMMARY}`, ""];
  for (const section of LLMS_SECTIONS) {
    lines.push(`## ${section.heading}`);
    for (const entry of section.entries) {
      lines.push(`- [${entry.title}](${resolveLlmsHref(entry.href)}): ${entry.description}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
