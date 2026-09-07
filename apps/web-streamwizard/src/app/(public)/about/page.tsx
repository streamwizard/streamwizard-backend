import type { Metadata } from "next";
import { absoluteUrl, aboutPageSchema } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { PageHero } from "@/components/public/layout/page-hero";
import { FinalCta } from "@/components/public/home/final-cta";
import { OriginSection } from "@/components/public/about/origin-section";
import { PillarsSection } from "@/components/public/about/pillars-section";
import { BuiltInPublicSection } from "@/components/public/about/built-in-public-section";
import { PrinciplesSection } from "@/components/public/about/principles-section";
import { GoalSection } from "@/components/public/about/goal-section";

/*
 * The story page, ordered the way a skeptical streamer would ask questions:
 * who made this and why (origin), what is it (pillars), can I check that
 * (built in public), what do you optimize for (principles), and where is
 * this going (goal). The FinalCta answers "fine, how do I try it".
 */
export const metadata: Metadata = {
  title: "About StreamWizard",
  description:
    "StreamWizard began as Twitch channel point chaos in 2023 and became clip folders in 2024. Now it is five streamer tools behind one Twitch login: cloud OBS for IRL, overlays, clips, VOD clipping and analytics. Open source, built by one person in the Netherlands, maintained with the community.",
  alternates: { canonical: absoluteUrl("/about") },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <JsonLd schema={aboutPageSchema()} />

      <PageHero
        eyebrow="About"
        eyebrowClassName="text-purple-300"
        title={
          <>
            Built by a streamer, <br /> for streamers.
          </>
        }
        lede="One person in the Netherlands has been building things for Twitch since 2023. In 2024 that turned into StreamWizard."
      />

      <OriginSection />
      <PillarsSection />
      <BuiltInPublicSection />
      <PrinciplesSection />
      <GoalSection />

      <FinalCta />
    </div>
  );
}
