import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl, faqPageSchema, softwareApplicationSchema, webSiteSchema } from "@/lib/seo";
import { Hero } from "@/components/public/home/hero";
import { TrustBand } from "@/components/public/home/trust-band";
import { CloudObsShowcase } from "@/components/public/home/cloud-obs-showcase";
import { OverlaysSection } from "@/components/public/home/overlays-section";
import { ClipsVods } from "@/components/public/home/clips-vods";
import { VodClipping } from "@/components/public/home/vod-clipping-section";
import { AnalyticsDemo } from "@/components/public/home/analytics-demo";
import { Faq, FAQ_ITEMS } from "@/components/public/home/faq";
import { FinalCta } from "@/components/public/home/final-cta";

const TITLE = "Cloud OBS, Overlays, Clips, VODs & Analytics for Twitch";
const DESCRIPTION =
  "Cloud OBS for IRL streaming, overlays, clip folders, VOD clipping, and stream analytics for Twitch. Open source and built in public.";

// No openGraph/twitter block: see the root layout for why. The social card
// gets this title plus og:site_name for the brand, and the file-based image.
export const metadata: Metadata = {
  // Plain, so the root's `%s – StreamWizard` template appends the brand like
  // every other page (SW-304). The five pillars come first; if Google clips
  // the tail it clips the brand, which og:site_name and the WebSite node
  // below already carry.
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/") },
};

// The clips marquee reads from the database; the hourly refresh lives on the
// cached data call in src/lib/showcase-clips.ts (this route renders
// dynamically because JsonLd carries the per-request CSP nonce).
export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <JsonLd schema={webSiteSchema()} />
      <JsonLd schema={softwareApplicationSchema()} />
      <JsonLd schema={faqPageSchema(FAQ_ITEMS)} />
      <Hero />
      <TrustBand />
      <CloudObsShowcase />
      <OverlaysSection />
      <ClipsVods />
      <VodClipping />
      <AnalyticsDemo />
      <Faq />
      <FinalCta />
    </div>
  );
}
