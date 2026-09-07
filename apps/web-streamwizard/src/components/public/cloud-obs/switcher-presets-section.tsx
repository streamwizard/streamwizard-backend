import { SectionView } from "@/components/public/analytics/section-view";
import { Reveal } from "@/components/public/home/reveal";
import { PresetTable } from "./preset-table";

/*
 * The numbers, printed. IRL streamers arrive here already running NOALBS and
 * comparing thresholds, so hiding them behind "smart defaults" reads as having
 * something to hide.
 */

export function SwitcherPresetsSection() {
  return (
    <section className="py-20">
      <SectionView section="switcher_presets" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Three presets. <br /> Or every number, yours.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Pick how twitchy it is and get on with your stream. The exact thresholds are below, because you are going to
            ask anyway.
          </p>
        </div>

        <div className="mx-auto max-w-4xl">
          <Reveal>
            <PresetTable />
          </Reveal>

        </div>
      </SectionView>
    </section>
  );
}
