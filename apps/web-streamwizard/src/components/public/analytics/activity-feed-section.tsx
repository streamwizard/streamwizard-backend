import { ListOrdered, ListFilter, Radio } from "lucide-react";
import { SectionView } from "./section-view";
import { Reveal } from "../home/reveal";
import { ActivityFeedDemo } from "./activity-feed-demo";

/*
 * The activity feed deep dive. ActivityFeedDemo carries the filter claim
 * with the real FILTERS list as working chips over the demo stream's raid
 * window; the rail beside it keeps the words. The event inventory in the
 * copy comes from EVENT_CONFIG (lib/event-config.ts): polls, hype trains and
 * ad breaks are real entries, not embellishment.
 */

const FEATURES = [
  {
    icon: ListOrdered,
    title: "In the order it happened",
    body: "Every event with its timestamp and its offset into the stream. The raid, then the follow wave it brought, right below it.",
  },
  {
    icon: ListFilter,
    title: "Filters that cut the noise",
    body: "One tap shows only the subs, only the raids, or only the redemptions. The 40 follows stop burying the one gifted-sub train.",
  },
  {
    icon: Radio,
    title: "Live while you are live",
    body: "During the stream, new events drop into the feed as they happen. After it ends, the whole night is there to scroll back through.",
  },
];

export function ActivityFeedSection() {
  return (
    <section className="py-20">
      <SectionView section="analytics_feed" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">The record</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Everything that happened, one feed.</h2>
          <p className="mt-4 text-muted-foreground">
            Follows, subs, cheers, raids, redemptions, shoutouts, polls, hype trains and ad breaks,
            recorded while you stream. One list instead of five Twitch tabs.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
          <Reveal>
            <ActivityFeedDemo />
          </Reveal>
          <Reveal>
            <div className="grid gap-6">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-purple-400" aria-hidden="true" />
                    <h3 className="text-sm font-semibold">{title}</h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </SectionView>
    </section>
  );
}
