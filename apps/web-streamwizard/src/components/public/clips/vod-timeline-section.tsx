import { ArrowRight } from "lucide-react";
import { Button } from "@repo/ui";
import { productSectionLinks } from "@/lib/constant";
import { SectionView } from "../analytics/section-view";
import { TrackedLink } from "../analytics/tracked-link";
import { Reveal } from "../home/reveal";

/*
 * Cross-sell band, kept small on purpose: the timeline, its events and the
 * clip handles get their full story on /vods (which links back here through
 * its clip-library door). This is the door, not a second copy of the room.
 * Amber, not purple like the other doors: it points at the VOD pillar, and
 * amber is that pillar's color everywhere else.
 */

/* A few dots from the real timeline's palette (EVENT_TYPE_CONFIG): a follow,
 * a raid, a clip already cut. */
const SKETCH_DOTS = [
  { key: "follow", className: "bg-blue-500", left: "14%" },
  { key: "raid", className: "bg-indigo-500", left: "38%" },
  { key: "clip", className: "bg-teal-500", left: "84%" },
];

export function VodTimelineSection() {
  return (
    <section className="py-20">
      <SectionView section="vod_timeline" className="container mx-auto px-4">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-8 max-w-md" aria-hidden="true">
              <div className="relative h-10 overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.04]">
                {SKETCH_DOTS.map(({ key, className, left }) => (
                  <div
                    key={key}
                    className={`absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${className}`}
                    style={{ left }}
                  />
                ))}
                {/* The clip selection, purple with grip edges like the real one */}
                <div className="absolute inset-y-0 left-[52%] w-[18%] border-x-2 border-purple-400/80 bg-purple-500/30" />
              </div>
            </div>
            <p className="font-mono text-xs tracking-widest text-amber-300 uppercase">VODs</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Nobody clipped it. Cut it from the VOD.</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Every stream&apos;s VOD carries a timeline that marks each follow, sub and raid. Drag a
              5 to 60 second selection out of it, and the clip lands right back in this library.
            </p>
            <div className="mt-8">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="gap-2 border-amber-400/30 bg-amber-400/[0.06] px-7 text-amber-200 shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:bg-amber-400/[0.12] hover:text-amber-100"
              >
                <TrackedLink href={productSectionLinks.vodsTimeline} cta="see_vods_page" section="vod_timeline">
                  See the VOD timeline
                  <ArrowRight className="size-4" aria-hidden="true" />
                </TrackedLink>
              </Button>
            </div>
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
