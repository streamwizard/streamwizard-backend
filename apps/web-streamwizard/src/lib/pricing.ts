/**
 * The one place the free-versus-paid split is written down.
 *
 * The pricing page, the SoftwareApplication `offers` node in seo.ts and the
 * FAQ answers all read from here, so a pricing change is one edit and the
 * page can never say something the structured data does not.
 *
 * Server-safe on purpose: seo.ts is imported from sitemap.ts and robots.ts,
 * so nothing here may pull in React.
 */

/** What costs nothing. Lower-case so it can sit mid-sentence. */
export const FREE_TIER_SUMMARY = "clip sync, clip folders, overlays, VOD clipping and stream analytics";

/** The paid part, stated without a price: there is no public price yet. */
export const PAID_PLAN_SUMMARY =
  "Cloud OBS, the ingest server and the mobile deck are a separate paid plan, currently in invite-only beta.";

/** The Offer description Google reads. Byte-for-byte what the page says. */
export const FREE_TIER_OFFER_DESCRIPTION = `Free tier: ${FREE_TIER_SUMMARY}. ${PAID_PLAN_SUMMARY}`;

/** Mirrors FREE_QUOTA_MB in actions/assets.ts, which enforces it. */
export const FREE_MEDIA_QUOTA_MB = 100;
