import type { Metadata } from "next";
import { absoluteUrl, breadcrumbSchema, faqPageSchema, softwareApplicationSchema } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { PageHero } from "@/components/public/layout/page-hero";
import { FinalCta } from "@/components/public/home/final-cta";
import { PlansSection } from "@/components/public/pricing/plans-section";
import { WhyPaidSection } from "@/components/public/pricing/why-paid-section";
import { PricingFaqSection, PRICING_FAQ_ITEMS } from "@/components/public/pricing/pricing-faq-section";

/*
 * The one page that answers "is it free" and "what does Cloud OBS cost". Every
 * other cost FAQ on the site links here rather than repeating itself. Ordered
 * the way the question gets asked: the two plans first, then why one of them
 * is paid, then the FAQ for the edge cases.
 */
const DESCRIPTION =
  "Clips, overlays, VOD clipping and analytics are free. Cloud OBS is a paid plan, in invite-only beta, because it runs a server for you. No hidden tiers.";

export const metadata: Metadata = {
  title: "Pricing",
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/pricing") },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <JsonLd schema={breadcrumbSchema("Pricing", "/pricing")} />
      <JsonLd schema={softwareApplicationSchema()} />
      <JsonLd schema={faqPageSchema(PRICING_FAQ_ITEMS)} />

      <PageHero
        eyebrow="Pricing"
        eyebrowClassName="text-purple-300"
        title={
          <>
            Most of it is free. <br /> The rest runs on a server.
          </>
        }
        lede="Clips, overlays, VOD clipping and analytics cost nothing. Cloud OBS needs a machine that encodes your stream for as long as you are live, so it is a paid plan. Two things on this page, and that is the whole list."
      />

      <PlansSection />
      <WhyPaidSection />
      <PricingFaqSection />
      <FinalCta />
    </div>
  );
}
