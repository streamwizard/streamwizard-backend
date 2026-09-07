import { Split, Table2, Target } from "lucide-react";
import { SectionView } from "./section-view";
import { Reveal, RevealGroup } from "../home/reveal";
import { CategoryFillDemo } from "./category-fill-demo";

/*
 * The category table deep dive. CategoryFillDemo plays the split claim out:
 * the clock sweeps, the row on air highlights, the marker pings where the
 * category changed. Its rows read demoCategorySegments directly (Elden Ring
 * 2h40 at 122 avg, Just Chatting 1h32 at 164 avg), the columns are
 * category-stats-table.tsx's real ones.
 */

const FEATURES = [
  {
    icon: Split,
    title: "A row per category",
    body: "Change category mid-stream and the stats split there. The game and the chatting half stop sharing one average.",
  },
  {
    icon: Table2,
    title: "The same columns for every game",
    body: "Duration, average and peak viewers, follows, subs and bits, per category. Comparable at a glance, in one table.",
  },
  {
    icon: Target,
    title: "Credit where it happened",
    body: "The raid that hit during the game counts for the game. Nothing bleeds into the category you switched to afterwards.",
  },
];

export function CategoryStatsSection() {
  return (
    <section className="py-20">
      <SectionView section="analytics_categories" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">By category</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Which game carried the stream.</h2>
          <p className="mt-4 text-muted-foreground">
            Streamed a game, then went Just Chatting? Each category gets its own numbers, so you can
            see which half your viewers actually showed up for.
          </p>
        </div>

        <Reveal>
          <CategoryFillDemo />
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
