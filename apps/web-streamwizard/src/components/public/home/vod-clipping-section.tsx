import { TrackedLink } from "../analytics/tracked-link";
import { SectionView } from "../analytics/section-view";
import { ArrowRight, Flag, Scissors } from "lucide-react";
import { Button } from "@repo/ui";
import { productLinks } from "@/lib/constant";
import { Reveal } from "./reveal";
import { VodTimelineDemo } from "./vod-timeline-demo";

/*
 * The VOD half of the clips story, given its own band: the clips section shows
 * what happens to a clip once it exists, this one shows where clips come from
 * when nobody hit the clip button in the moment.
 */

const features = [
  {
    icon: Flag,
    title: "Every moment marked",
    body: "Follows, subs, cheers, raids, ad breaks and muted audio all sit on the timeline. The raid you half remember is the indigo dot at 2:10:00.",
  },
  {
    icon: Scissors,
    title: "Drag it out, 5 to 60 seconds",
    body: "Open Create Clip, drag the handles, and the selection loops while you tune it. Name it, save it, and it lands back on the timeline as a clip.",
  },
];

export function VodClipping({
  showProductLink = true,
  showHeader = true,
}: { showProductLink?: boolean; showHeader?: boolean } = {}) {
  return (
    <section className="relative py-20">
      <SectionView section="vods" className="container mx-auto px-4">
        {showHeader && (
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Nobody clipped it. Go get it anyway.</h2>
            <p className="mt-4 text-muted-foreground">
              The best moment of the stream is the one chat was too busy to clip. Open the VOD, find
              it on the timeline, and cut it yourself.
            </p>
          </div>
        )}

        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12">
          <Reveal>
            <VodTimelineDemo />
          </Reveal>
          <Reveal>
            <div>
              <h3 className="text-xl font-semibold">Four hours, one moment.</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                This is the VOD page on a real stream: 4h 12m, a raid at 2:10:00, three clips already
                cut out of it. The playhead is already sweeping. Drag a clip out of the timeline.
              </p>
              <div className="mt-6 grid gap-6">
                {features.map(({ icon: Icon, title, body }) => (
                  <div key={title}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-amber-400" aria-hidden="true" />
                      <h4 className="text-sm font-semibold">{title}</h4>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {showProductLink ? (
          <div className="mt-12 text-center">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="gap-2 border-amber-400/30 bg-amber-400/[0.06] px-7 text-amber-200 shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:bg-amber-400/[0.12] hover:text-amber-100"
            >
              <TrackedLink href={productLinks.vods} cta="more_about_vods" section="vods">
                More about VOD clipping
                <ArrowRight className="size-4" aria-hidden="true" />
              </TrackedLink>
            </Button>
          </div>
        ) : null}
      </SectionView>
    </section>
  );
}
