import { SectionView } from "@/components/public/analytics/section-view";
import { Reveal } from "@/components/public/home/reveal";

/*
 * The closing statement: where the project is headed and who it belongs to.
 * Deliberately a plain centered block, no cards and no glow, so the FinalCta
 * panel right under it stands alone.
 */
export function GoalSection() {
  return (
    <section className="py-20">
      <SectionView section="goal" className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-purple-300">The goal</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Streamer tools for everyone, <br className="hidden sm:block" /> maintained by the
            community.
          </h2>
          <Reveal className="mt-6 space-y-4 text-lg text-muted-foreground">
            <p>
              The goal is a full set of streamer tools that anyone can use. Most of it free. The
              parts that burn server money, like cloud OBS, cost money. That is the whole pricing
              model.
            </p>
            <p>
              Open source is the other half. StreamWizard is for the streamer community, built and
              maintained by that community. Anyone can open an issue, ship a fix or build the
              widget they are missing. No big company. Streamers building for streamers.
            </p>
          </Reveal>
        </div>
      </SectionView>
    </section>
  );
}
