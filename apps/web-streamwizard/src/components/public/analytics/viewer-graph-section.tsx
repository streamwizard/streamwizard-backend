import { LineChart, Pin, PlayCircle } from "lucide-react";
import { SectionView } from "./section-view";
import { Reveal, RevealGroup } from "../home/reveal";
import { ViewerEventsDemo } from "./viewer-events-demo";

/*
 * The viewer graph deep dive. The full chart already runs in the shared band
 * above; the demo here tells the part the chart cannot say about itself —
 * the events pinned to the line, lit one at a time by ViewerEventsDemo. The
 * cards keep the claims the sparkline cannot carry.
 */

const FEATURES = [
  {
    icon: LineChart,
    title: "A dot per minute",
    body: "Viewer counts are sampled while you are live, so the line shows the whole arc: the slow start, the raid bump, the drop when you said one more game.",
  },
  {
    icon: Pin,
    title: "Events pinned to the line",
    body: "Follows and subs sit on the graph at the minute they happened. The spike stops being a mystery when there is a raid marker on top of it.",
  },
  {
    icon: PlayCircle,
    title: "Clips you can open",
    body: "Every clip cut during the stream lands on the graph too. Click the dot and the clip plays right there, so you see what the chat saw.",
  },
];

export function ViewerGraphSection() {
  return (
    <section className="py-20">
      <SectionView section="analytics_graph" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">The graph</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">The line knows why it moved.</h2>
          <p className="mt-4 text-muted-foreground">
            Twitch tells you the peak. This graph tells you the minute it happened and what caused
            it, because the events sit right on the line.
          </p>
        </div>

        <Reveal>
          <ViewerEventsDemo />
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
