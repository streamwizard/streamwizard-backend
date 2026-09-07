import { SectionView } from "@/components/public/analytics/section-view";
import { Reveal } from "@/components/public/home/reveal";
import { PillarConstellation } from "./pillar-constellation";

/*
 * What StreamWizard is, drawn as the five product pillars around one login.
 * The nodes link out to the product pages, which carry the detail this page
 * deliberately skips.
 */
export function PillarsSection() {
  return (
    <section className="py-20">
      <SectionView section="pillars" className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Five tools, one login.</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Built separately, wired together. Each card has its own page with the full story.
          </p>
        </div>

        <Reveal className="mt-12">
          <PillarConstellation />
        </Reveal>
      </SectionView>
    </section>
  );
}
