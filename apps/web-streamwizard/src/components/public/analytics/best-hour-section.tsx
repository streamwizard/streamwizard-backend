import { BarChart3, MessageSquareText, Scale } from "lucide-react";
import { SectionView } from "./section-view";
import { Reveal, RevealGroup } from "../home/reveal";
import { BestHourDemo } from "./best-hour-demo";

/*
 * The hourly breakdown deep dive. BestHourDemo's bars read demoHourlyStats
 * directly (avg viewers 70 / 120 / 187 / 165, hour 3 best), so the scan
 * cannot drift from the demo the band above is running. The three cards
 * paraphrase explainBestHour's actual verdicts (hourly-viewer-chart.tsx):
 * viewer lead, interaction lead, or the combined score.
 */

const FEATURES = [
  {
    icon: BarChart3,
    title: "Hour by hour",
    body: "The stream gets split into full hours, each with its average and peak viewers. Four hours of streaming stops being one blurry number.",
  },
  {
    icon: MessageSquareText,
    title: "Chat counts too",
    body: "Follows, subs, bits, raids and redemptions are tallied per hour. A quiet-viewers hour with a busy chat still gets its credit.",
  },
  {
    icon: Scale,
    title: "The verdict, in words",
    body: "The best hour comes with its reason: most viewers, most interactions, or the strongest combination. Not just a highlighted bar you have to interpret.",
  },
];

export function BestHourSection() {
  return (
    <section className="py-20">
      <SectionView section="analytics_best_hour" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">The best hour</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">One hour won. You get told why.</h2>
          <p className="mt-4 text-muted-foreground">
            Every stream has an hour that outperformed the rest. StreamWizard names it and explains
            what it won on, in a sentence, not a spreadsheet.
          </p>
        </div>

        <Reveal>
          <BestHourDemo />
        </Reveal>

        <RevealGroup
          className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3"
          items={FEATURES.map(({ icon: Icon, title, body }) => ({
            node: (
              <div className="h-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-purple-400" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">{title}</h3>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ),
          }))}
        />
      </SectionView>
    </section>
  );
}
