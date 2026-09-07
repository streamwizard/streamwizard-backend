import { ArrowRight } from "lucide-react";
import { Button } from "@repo/ui";
import { productSectionLinks } from "@/lib/constant";
import { SectionView } from "../analytics/section-view";
import { TrackedLink } from "../analytics/tracked-link";
import { Reveal } from "../home/reveal";
import { SceneSwitchLoop } from "./scene-switch-loop";

/*
 * Cross-sell band, kept small on purpose: cloud OBS, the deck and the auto
 * switcher get their full story on /cloud-obs. This is the door, not a second
 * copy of the room; the one claim that belongs here is that their scene
 * switches land on the VOD timeline, and SceneSwitchLoop acts it out. Purple,
 * because it points at the cloud OBS pillar.
 */

export function SceneSwitchesSection() {
  return (
    <section className="py-20">
      <SectionView section="scene_switches" className="container mx-auto px-4">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <SceneSwitchLoop />
            <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">Cloud OBS</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Every scene switch, on the record.</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Stream through cloud OBS and every scene change lands on the timeline as a dot, from
              scene to scene. The one you tapped on the deck, and the one the auto switcher made
              when your signal dropped. Scrub the VOD and see exactly when the stream went to BRB.
            </p>
            <div className="mt-8">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="gap-2 border-purple-400/30 bg-purple-400/[0.06] px-7 text-purple-200 shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:bg-purple-400/[0.12] hover:text-purple-100"
              >
                <TrackedLink href={productSectionLinks.cloudObsAutoSwitcher} cta="see_cloud_obs" section="scene_switches">
                  See cloud OBS
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
