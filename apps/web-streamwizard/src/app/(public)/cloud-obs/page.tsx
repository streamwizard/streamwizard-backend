import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";
import { CloudObsShowcase } from "@/components/public/home/cloud-obs-showcase";
import { IngestSection } from "@/components/public/cloud-obs/ingest-section";
import { AutoSwitcherSection } from "@/components/public/cloud-obs/auto-switcher-section";
import { SwitcherPresetsSection } from "@/components/public/cloud-obs/switcher-presets-section";
import { ChatNoticesSection } from "@/components/public/cloud-obs/chat-notices-section";
import { DeckSection } from "@/components/public/cloud-obs/deck-section";
import { SwitcherDemoProvider } from "@/components/public/cloud-obs/switcher-demo-store";
import { IrlOverlaysSection } from "@/components/public/cloud-obs/irl-overlays-section";
import { CloudObsFaqSection } from "@/components/public/cloud-obs/cloud-obs-faq-section";
import { BetaNote } from "@/components/public/cloud-obs/beta-note";
import { FinalCta } from "@/components/public/home/final-cta";

/*
 * Cloud OBS for IRL streamers. The showcase is the summary, shared with the
 * landing page; everything after it is the detail that page has no room for:
 * the ingest server, the auto switcher and how it decides, the presets with
 * their actual numbers, chat notices, the deck, and the FAQ.
 *
 * The three switcher sections share one demo through SwitcherDemoProvider: the
 * preset table's chips retune the walk in the demo frame, and the chat feed
 * shows the messages that walk produced. Keeping them under one provider is
 * what makes the numbers on the page the same numbers throughout.
 */
export const metadata: Metadata = {
  title: "Cloud OBS for IRL streaming",
  description:
    "A dedicated OBS for your channel in the cloud, run from the deck on your phone. SRT and SRTLA ingest, and an auto switcher that moves you to a fallback scene when the connection drops and tells chat why. Stream IRL without a PC.",
  alternates: { canonical: absoluteUrl("/cloud-obs") },
};

export default function CloudObsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <section className="pt-16 md:pt-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">Cloud OBS</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Your OBS, in the cloud. <br /> Your phone runs it.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Built for IRL streamers. A dedicated OBS for your channel, an ingest that speaks SRT and SRTLA, and an
              auto switcher that covers for your connection before chat notices.
            </p>
          </div>
        </div>
      </section>

      <CloudObsShowcase showProductLink={false} showHeader={false} />
      <IngestSection />

      <SwitcherDemoProvider>
        <AutoSwitcherSection />
        <SwitcherPresetsSection />
        <ChatNoticesSection />
      </SwitcherDemoProvider>

      <DeckSection />
      <IrlOverlaysSection />
      <CloudObsFaqSection />
      <BetaNote />
      <FinalCta />
    </div>
  );
}
