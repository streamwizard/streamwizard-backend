import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { SectionView } from "@/components/public/analytics/section-view";
import { discordInviteLink, docsLink } from "@/lib/constant";
import { Reveal } from "@/components/public/home/reveal";
import { IrlOverlayDemo } from "@/components/public/home/irl-overlay-demo";
import { DemoAlertProvider } from "@/components/public/home/overlay-demo-alert";

/*
 * The overlays section scoped to what matters on this page: the IRL overlays
 * and the connection lost scene. The chips list what actually ships, split the
 * way the product splits it: the walking stats bar's modules are derived on the
 * phone (distance, location, weather are not standalone widgets), and the
 * single-value widgets are the raw GPS fields. Anything missing is a Discord
 * request away. The full widget library bento lives on /overlays, not here.
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

export function IrlOverlaysSection() {
  return (
    <section id="irl-overlays" className="scroll-mt-24 py-20">
      <SectionView section="irl_overlays" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Overlays that know where you are.</h2>
          <p className="mt-4 text-muted-foreground">
            Speed, distance, city, and weather, straight from the phone you stream with. Build it in the editor, paste
            one URL into cloud OBS.
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
          <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              When the feed drops, the auto switcher cuts to your connection lost scene. Build that one in the same
              editor: clips from your last stream and a hang tight message beat a frozen frame.
            </p>
            <p className="text-sm text-muted-foreground">
              Want a widget that is not here?{" "}
              <TrackedLink
                href={discordInviteLink}
                cta="request_widget_discord"
                section="irl_overlays"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-300 transition-colors hover:text-purple-200"
              >
                Ask in the Discord
              </TrackedLink>
              . That is where the widget list grows.
            </p>
            <p className="text-sm text-muted-foreground">
              Same editor, same widgets, in the OBS on your PC too.{" "}
              <TrackedLink
                href={`${docsLink}/overlays/overview`}
                cta="read_overlay_docs"
                section="irl_overlays"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-300 transition-colors hover:text-purple-200"
              >
                Read the overlay docs
              </TrackedLink>
            </p>
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
