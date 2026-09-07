import { CalendarRange, Gamepad2, Scissors, Search, Star, Tv } from "lucide-react";
import { SectionView } from "../analytics/section-view";
import { RevealGroup } from "../home/reveal";

/*
 * Plain inventory of the filter bar, one card per filter. The streamer card
 * carries the honest constraint: browsing another channel only works once
 * that channel's clips are synced into StreamWizard.
 */

const FILTERS = [
  {
    icon: Search,
    title: "Search",
    body: "Free text over clip titles. Three letters is enough to start matching.",
  },
  {
    icon: Gamepad2,
    title: "Category",
    body: "One game at a time. Only the Valorant aces, or only Just Chatting.",
  },
  {
    icon: Tv,
    title: "Streamer",
    body: "Browse another channel's clip library. Works for any streamer who has their clips synced with StreamWizard.",
  },
  {
    icon: Scissors,
    title: "Clipped by",
    body: "Who hit the clip button. Your editor's clips, or that one mod who clips everything.",
  },
  {
    icon: CalendarRange,
    title: "Date range",
    body: "Presets from the last week back to a year, or an exact custom range.",
  },
  {
    icon: Star,
    title: "Featured",
    body: "Only the clips marked as featured on Twitch. The good ones, by your own admission.",
  },
];

export function ClipsFiltersSection() {
  return (
    <section className="py-20">
      <SectionView section="clips_filters" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">Filters</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Filter down to the one you meant.</h2>
          <p className="mt-4 text-muted-foreground">
            Every filter stacks with the others and shows as a chip you can drop. Sort by views or
            date when you are done.
          </p>
        </div>

        <RevealGroup
          className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3"
          items={FILTERS.map(({ icon: Icon, title, body }) => ({
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
