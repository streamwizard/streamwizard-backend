import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";
import { OverlaysSection } from "@/components/public/home/overlays-section";
import { AlertBoxSection } from "@/components/public/overlays/alert-box-section";
import { ClipsRotatorSection } from "@/components/public/overlays/clips-rotator-section";
import { WidgetLibrarySection } from "@/components/public/overlays/widget-library-section";
import { IrlWidgetsSection } from "@/components/public/overlays/irl-widgets-section";
import { EditorSection } from "@/components/public/overlays/editor-section";
import { OverlaysFaqSection } from "@/components/public/overlays/overlays-faq-section";
import { FinalCta } from "@/components/public/home/final-cta";

/*
 * Overlays, same shape as /cloud-obs: the landing page's section is the
 * summary, everything after it is the detail that page has no room for. The
 * alert box gets the special treatment (it is the widget people come for),
 * then the clips rotator's sourcing story, the library for the streamers who
 * install rather than build, the IRL widgets, the editor tour, and a FAQ that
 * carries the setup and free story.
 */
export const metadata: Metadata = {
  title: "Stream overlays and alerts",
  description:
    "Alert box, clips rotator, countdowns and live GPS widgets in one browser source. Install widgets other streamers built, or write your own. Free, with no paywall on alerts.",
  alternates: { canonical: absoluteUrl("/overlays") },
};

export default function OverlaysPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <section className="pt-16 md:pt-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-purple-300">Overlays</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              One browser source. <br /> Everything you put on stream.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Alerts, clips, countdowns, GPS widgets, and whatever you install from the library. Build the scene here,
              paste one URL into OBS, and change it without opening OBS again.
            </p>
          </div>
        </div>
      </section>

      <OverlaysSection showProductLink={false} showHeader={false} />
      <AlertBoxSection />
      <ClipsRotatorSection />
      <WidgetLibrarySection />
      <IrlWidgetsSection />
      <EditorSection />
      <OverlaysFaqSection />
      <FinalCta />
    </div>
  );
}
