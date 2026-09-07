import { ArrowRight } from "lucide-react";
import { Button } from "@repo/ui";
import { productSectionLinks } from "@/lib/constant";
import { SectionView } from "../analytics/section-view";
import { TrackedLink } from "../analytics/tracked-link";
import { Reveal } from "../home/reveal";
import { IrlOverlayDemo } from "../home/irl-overlay-demo";
import { DemoAlertProvider } from "../home/overlay-demo-alert";

/*
 * The IRL widgets sold as widgets, for anyone with a phone: the cloud OBS page
 * has the same demo framed as part of the no-PC setup, so this section leans
 * on what the widgets know (weather, distance, the city) and sends the
 * streaming-without-a-PC story to /cloud-obs instead of retelling it. Its
 * section id is its own, so the funnel dashboard can tell the two pages apart.
 */

const WIDGET_GROUPS: { label: string; note: string; items: string[] }[] = [
  {
    label: "The walking stats bar",
    note: "One bar along the bottom. Toggle each module on or off.",
    items: ["Speed", "Distance", "Location", "Weather"],
  },
  {
    label: "Single-value widgets",
    note: "Straight from the GPS. Place them anywhere on the canvas.",
    items: ["Speed", "Heading", "Altitude", "Latitude", "Longitude", "Accuracy"],
  },
];

export function IrlWidgetsSection() {
  return (
    <section className="py-20">
      <SectionView section="irl_widgets" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">IRL</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            Speed, distance, city, weather. <br /> From the phone in your pocket.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            The walking stats bar and six single-value GPS widgets, fed by the phone you already stream with.
          </p>
          <p className="mt-2 text-sm text-muted-foreground/70">Just don&apos;t dox yourself while your home.</p>
        </div>

        <DemoAlertProvider>
          <Reveal direction="scale">
            <IrlOverlayDemo />
          </Reveal>
        </DemoAlertProvider>

        <Reveal>
          <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
            {WIDGET_GROUPS.map((group) => (
              <div key={group.label} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-purple-300">{group.label}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-xs text-foreground"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{group.note}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal>
          <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-4 text-center">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>The GPS comes from the phone&apos;s browser. No extra hardware, no third party tracker.</li>
              <li>The weather comes from where you are. No API key, no account anywhere else.</li>
              <li>Distance lives on the server, so a refreshed browser source does not zero your walk.</li>
            </ul>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="gap-2 border-purple-400/30 bg-purple-400/[0.06] px-7 text-purple-200 shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:bg-purple-400/[0.12] hover:text-purple-100"
            >
              <TrackedLink href={productSectionLinks.cloudObsIrlOverlays} cta="see_cloud_obs" section="irl_widgets">
                Works perfect with cloud OBS
                <ArrowRight className="size-4" aria-hidden="true" />
              </TrackedLink>
            </Button>
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
