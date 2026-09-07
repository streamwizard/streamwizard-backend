import { TrackedLink } from "../analytics/tracked-link";
import { SectionView } from "../analytics/section-view";
import { ArrowRight } from "lucide-react";
import { Button } from "@repo/ui";
import { productLinks } from "@/lib/constant";
import { Reveal } from "./reveal";
import { StreamOverlayDemo } from "./stream-overlay-demo";
import { DemoAlertProvider } from "./overlay-demo-alert";
import { OverlayWidgetCards } from "./overlay-widget-cards";

/*
 * Overlays are their own pillar and they are for every streamer, not only the
 * IRL ones. The section leads with the two scenes every channel has (starting
 * soon, live) and shows the widget library underneath; the IRL GPS widgets get
 * one card here and the full treatment on /cloud-obs. Works in cloud OBS and
 * in the OBS on your PC alike; one browser source either way.
 */

export function OverlaysSection({
  showProductLink = true,
  showHeader = true,
}: { showProductLink?: boolean; showHeader?: boolean } = {}) {
  return (
    <section className="py-20">
      <SectionView section="overlays" className="container mx-auto px-4">
        {showHeader && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Alerts, chat, clips, countdowns. One browser source.</h2>
            <p className="mt-4 text-muted-foreground">
              Build the overlay in the editor, paste one URL into OBS. Starting screen, BRB, live: same widgets, your
              media.
            </p>
          </div>
        )}

        {/* One provider over demo and grid: the alert that fires in the
            frame is the event the alert box card selects. */}
        <DemoAlertProvider>
          <Reveal direction="scale">
            <StreamOverlayDemo />
          </Reveal>

          <Reveal className="mt-16">
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">The widget library</p>
            <OverlayWidgetCards />
          </Reveal>
        </DemoAlertProvider>

        <Reveal>
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-muted-foreground">
              Free and open source, like the rest of the dashboard.
            </p>
            {showProductLink ? (
              <Button
                asChild
                variant="outline"
                size="lg"
                className="gap-2 border-purple-400/30 bg-purple-400/[0.06] px-7 text-purple-200 shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:bg-purple-400/[0.12] hover:text-purple-100"
              >
                <TrackedLink href={productLinks.overlays} cta="more_about_overlays" section="overlays">
                  More about overlays
                  <ArrowRight className="size-4" aria-hidden="true" />
                </TrackedLink>
              </Button>
            ) : null}
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
