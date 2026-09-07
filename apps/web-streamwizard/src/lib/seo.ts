import { discordInviteLink, docsLink, githubLink, twitchChannelLink } from "@/lib/constant";
import { env } from "@/lib/env";

/**
 * Single source of truth for what search engines may see.
 *
 * This is an explicit allowlist, not a filesystem crawl: every public route is
 * listed by hand so a new route under (protected) or (auth) can never leak into
 * the sitemap by accident.
 */
export type PublicRoute = {
  path: string;
  /**
   * ISO date of the last real copy change on the page. Google only trusts
   * lastmod when it moves with content, so bump this by hand when the page
   * text changes; a build timestamp on every route teaches it to ignore the
   * field. changefreq and priority are deliberately absent: Google ignores both.
   */
  lastModified: string;
};

export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/", lastModified: "2026-09-06" },
  { path: "/cloud-obs", lastModified: "2026-08-29" },
  { path: "/overlays", lastModified: "2026-08-29" },
  { path: "/clips", lastModified: "2026-08-29" },
  { path: "/vods", lastModified: "2026-08-29" },
  { path: "/analytics", lastModified: "2026-08-29" },
  { path: "/about", lastModified: "2026-08-29" },
  { path: "/contact", lastModified: "2026-08-29" },
  { path: "/roadmap", lastModified: "2026-08-29" },
  { path: "/privacy-policy", lastModified: "2026-05-26" },
  { path: "/terms-of-service", lastModified: "2026-05-26" },
];

/**
 * Paths that exist but must never be crawled: everything behind auth, which
 * only ever answers a crawler with a redirect to /login.
 *
 * /goodbye, /error and /unauthorized are deliberately absent. They need to
 * stay *out of the index* rather than merely uncrawled, and a crawler blocked
 * here could never read the noindex tag that does that. Each carries
 * `robots: { index: false }` instead. /login is absent because it is meant to
 * be found: it is the answer to a "streamwizard login" search.
 */
export const DISALLOWED_PATHS = ["/api/", "/auth/", "/dashboard", "/deck", "/obs-viewer"];

/** The one host whose content is the real, indexable site. */
const CANONICAL_HOST = "streamwizard.org";
const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;

/**
 * The env schema types this as a required URL, but `SKIP_ENV_VALIDATION` turns
 * validation off entirely — which is how CI builds, with no Doppler secrets. So
 * at build time this really can be undefined, whatever the type says.
 */
function configuredBaseUrl(): string | undefined {
  const raw = env.NEXT_PUBLIC_BASE_URL as string | undefined;
  if (!raw) return undefined;
  try {
    new URL(raw);
    return raw;
  } catch {
    return undefined;
  }
}

/**
 * Base URL for building absolute links. Falls back to the canonical origin so a
 * secret-less build still produces valid metadata instead of throwing on
 * `new URL(undefined)`.
 */
export function siteUrl(): string {
  return configuredBaseUrl() ?? CANONICAL_ORIGIN;
}

/**
 * Staging and local both run this same code with a different NEXT_PUBLIC_BASE_URL,
 * so the host decides indexability. No extra env var to forget to set — pointing
 * an environment at a non-prod domain is itself the signal to stay out of the index.
 *
 * Note this deliberately does NOT use siteUrl(): an unset base URL must read as
 * "not the production site", or a misconfigured deploy would inherit the
 * fallback origin and advertise itself as indexable.
 */
export function isIndexableEnvironment(): boolean {
  const configured = configuredBaseUrl();
  if (!configured) return false;
  return new URL(configured).hostname === CANONICAL_HOST;
}

/**
 * Absolute URL for a public path, built off the environment's own base URL.
 *
 * The bare root comes back as the origin with no trailing slash. `URL` would
 * serialise it as `https://streamwizard.org/`, while Next normalises the
 * canonical tag to the slash-less form, so the sitemap, JSON-LD `url` fields
 * and the canonical disagreed on which home URL is the real one.
 */
export function absoluteUrl(path: string): string {
  const url = new URL(path, siteUrl());
  if (url.pathname === "/" && !url.search && !url.hash) return url.origin;
  return url.toString();
}

/**
 * Sitewide publisher identity. Rendered once in the public layout; every other
 * schema block references it by @id rather than repeating the organization.
 */
export function organizationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: "StreamWizard",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/logo.png"),
    foundingDate: "2024",
    address: { "@type": "PostalAddress", addressCountry: "NL" },
    sameAs: [discordInviteLink, githubLink, twitchChannelLink],
  };
}

/**
 * The about page as an entity. It only points at the organization and website
 * nodes rendered elsewhere; the facts live on those nodes, not here.
 */
export function aboutPageSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": absoluteUrl("/about#about"),
    name: "About StreamWizard",
    url: absoluteUrl("/about"),
    inLanguage: "en",
    about: { "@id": absoluteUrl("/#organization") },
    isPartOf: { "@id": absoluteUrl("/#website") },
  };
}

/**
 * The site as an entity, separate from the company that publishes it.
 *
 * Rendered on the home page only: WebSite describes the whole domain, so a
 * second copy on every route would just be the same node repeated. It carries
 * the @id the other schema blocks can point at.
 */
export function webSiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: "StreamWizard",
    url: absoluteUrl("/"),
    inLanguage: "en",
    description:
      "Cloud OBS for IRL streaming, overlays, clip management, and stream analytics for Twitch streamers. Open source and built in public.",
    publisher: { "@id": absoluteUrl("/#organization") },
  };
}

/**
 * The home page FAQ, as a FAQPage rich result. Questions and answers come from
 * the section itself so the two can never drift apart.
 */
export function faqPageSchema(
  items: readonly { question: string; answer: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

/** The product itself: what AI answers and rich results read to describe us. */
export function softwareApplicationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": absoluteUrl("/#software"),
    name: "StreamWizard",
    url: absoluteUrl("/"),
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    inLanguage: "en",
    image: absoluteUrl("/logo.png"),
    screenshot: absoluteUrl("/img/landing-page/hero-dark.webp"),
    softwareHelp: { "@type": "WebPage", url: docsLink },
    sameAs: [githubLink],
    description:
      "Cloud OBS for IRL streaming, overlays, clip management, and stream analytics for Twitch streamers. Open source and built in public.",
    publisher: { "@id": absoluteUrl("/#organization") },
    // Every entry is something a public page actually demonstrates (the
    // landing page, or the product page it links to). AI answers quote this
    // list without the page around it, so nothing here may be aspirational and
    // the wording has to stand on its own.
    featureList: [
      "Cloud OBS: a dedicated OBS for your channel in the cloud, streamed into over SRT or SRTLA",
      "SRTLA ingest that bonds several mobile connections into one stream, measured once a second",
      "Mobile deck to go live, switch scenes, and edit stream title and category from your phone",
      "Auto switcher that watches bitrate, ping and dropped packets, swaps to a fallback scene when the connection goes bad, and returns once it is stable",
      "Auto switcher chat notices posted as the broadcaster, carrying the bitrate, ping and packet loss behind the switch",
      "Stream overlays with alerts, chat, clips and countdowns in a single browser source",
      "Automatic Twitch clip sync with nested clip folders, stacking filters, and portrait downloads",
      "VOD timeline marking follows, subs, cheers, raids and ad breaks, with 5 to 60 second clip creation",
      "Per-stream analytics with follows, subs and clips plotted on the viewer graph",
    ],
    license: "https://opensource.org/licenses/MIT",
    // Google wants offers, review or aggregateRating before it shows a software
    // rich result. The one honest offer is the free tier, so the description
    // spells out what the zero covers and names the paid part; a bare "0" would
    // contradict the FAQ on the same page, which says Cloud OBS is paid. No
    // price for Cloud OBS until pricing is public.
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      url: absoluteUrl("/"),
      description:
        "Free tier: clip sync, clip folders, overlays, VOD clipping and stream analytics. Cloud OBS, the ingest server and the mobile deck are a separate paid plan, currently in invite-only beta.",
    },
  };
}
