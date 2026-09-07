import { ArrowRight } from "lucide-react";
import { Button } from "@repo/ui";
import { productSectionLinks } from "@/lib/constant";
import { SectionView } from "./section-view";
import { TrackedLink } from "./tracked-link";
import { Reveal } from "../home/reveal";
import { DoorSpikeBeat } from "./door-spike-beat";

/*
 * Cross-sell band, kept small on purpose: the timeline, the event dots and
 * the clip handles get their full story on /vods. This is the door, not a
 * second copy of the room; the one claim that belongs here is that the graph
 * and the VOD timeline are the same event record in two shapes. Amber,
 * because it points at the VOD pillar. DoorSpikeBeat acts the claim out:
 * bars rise, the raid dot pings, the clip window closes around the spike.
 */

export function VodsDoorSection() {
  return (
    <section className="py-20">
      <SectionView section="spike_to_clip" className="container mx-auto px-4">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <DoorSpikeBeat />
            <p className="font-mono text-xs tracking-widest text-amber-300 uppercase">VODs</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">The spike has a video.</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              The events on this graph land on your VOD&apos;s timeline too, as dots you can click.
              So when the chart shows the night&apos;s big moment, open the VOD, jump to that
              second, and cut it into a real Twitch clip.
            </p>
            <div className="mt-8">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="gap-2 border-amber-400/30 bg-amber-400/[0.06] px-7 text-amber-200 shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:bg-amber-400/[0.12] hover:text-amber-100"
              >
                <TrackedLink href={productSectionLinks.vodsTimeline} cta="see_vods_page" section="spike_to_clip">
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
