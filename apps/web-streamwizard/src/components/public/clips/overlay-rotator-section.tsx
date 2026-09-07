import { ArrowRight } from "lucide-react";
import { Button, cn } from "@repo/ui";
import { productSectionLinks } from "@/lib/constant";
import { SectionView } from "../analytics/section-view";
import { TrackedLink } from "../analytics/tracked-link";
import { Reveal } from "../home/reveal";

/*
 * Cross-sell band, kept small on purpose: the rotator's full demo and its
 * sourcing story live on /overlays (clips-rotator-section), which links back
 * here. This is the door, not a second copy of the room.
 */

const ROTATION_CARDS = [
  { label: "IRL walks", tint: "from-emerald-500/30", className: "-rotate-6" },
  { label: "Best of 2026", tint: "from-sky-500/30", className: "rotate-2 -mt-2" },
  { label: "Aces", tint: "from-purple-500/30", className: "rotate-6" },
];

export function OverlayRotatorSection() {
  return (
    <section className="py-20">
      <SectionView section="overlay_rotator" className="container mx-auto px-4">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-8 flex items-end justify-center gap-3" aria-hidden="true">
              {ROTATION_CARDS.map(({ label, tint, className }) => (
                <div
                  key={label}
                  className={cn("w-32 overflow-hidden rounded-lg border border-white/[0.08] sm:w-36", className)}
                >
                  <div className={cn("aspect-video bg-gradient-to-br to-black/60", tint)} />
                  <p className="truncate border-t border-white/[0.08] bg-black/30 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>
            <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">On stream</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Your folders, playing on your starting screen.</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              The overlay&apos;s clips rotator points at a folder, a game, or a filter and plays the
              result on your starting or BRB screen. File a clip mid-stream and it joins the rotation
              without a refresh. The best-of reel builds itself while you play.
            </p>
            <div className="mt-8">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="gap-2 border-purple-400/30 bg-purple-400/[0.06] px-7 text-purple-200 shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:bg-purple-400/[0.12] hover:text-purple-100"
              >
                <TrackedLink
                  href={productSectionLinks.overlaysClipsRotator}
                  cta="see_overlays_page"
                  section="overlay_rotator"
                >
                  See the clips rotator
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
