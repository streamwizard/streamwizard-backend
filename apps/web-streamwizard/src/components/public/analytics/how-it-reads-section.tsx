import { Activity, Database, Trophy } from "lucide-react";
import { SectionView } from "./section-view";
import { Reveal, RevealGroup } from "../home/reveal";

/*
 * The method, spelled out (SW-308). The sections above show what the page
 * says; this one says where each number comes from and how the verdict is
 * scored, in the same terms the code uses (lib/analytics/hourly-buckets.ts
 * and the rest-api viewer count poller), plus two worked reads so the rules
 * land on a stream that looks like a real one. Every figure here has to stay
 * true to that code: the five minute sample, the two-half score, no chat.
 */

const SOURCES = [
  {
    icon: Activity,
    title: "Sampled every five minutes",
    body: "While you are live, StreamWizard asks Twitch for your viewer count every five minutes and stores it with the offset from the start of the stream. The graph is those samples joined up, so a four hour stream is about fifty real points, not a curve someone smoothed.",
  },
  {
    icon: Trophy,
    title: "The best hour, scored",
    body: "The stream is split into full hours. Each hour gets two marks: its average viewers against the best hour's average, and its follows, subs, raids and redemptions against the busiest hour's count. Half of each, added up, is the score. The highest wins, and the reason says which half carried it.",
  },
  {
    icon: Database,
    title: "Kept, and not kept",
    body: "Events are stored: follows, subs, raids, redemptions, clips, and the category you were streaming under. Chat messages are never stored. Your stream data stays until you delete your account or disconnect Twitch, and the off switch in Settings is real: flip it and the numbers go away.",
  },
];

const READS = [
  {
    title: "A raid beats the busy hour",
    body: "Four hour stream. Hour two averages 55 viewers with three follows and a sub. Hour three averages 48, but a raid lands, six people follow and two subscribe. On viewers alone hour two wins. On interactions hour three has nine to hour two's four, and that half of the score is worth as much as the viewers. Hour three wins, and the verdict says why: most interactions. That is the hour to go and clip.",
  },
  {
    title: "The game and the chatting half",
    body: "Two hours forty of a game at 122 average viewers, then an hour and a half of Just Chatting at 164. One average for the night would read about 137 and hide the whole story. The category table splits the two, so you see that the chatting half pulled more people, and the raid that hit during the game stays with the game, because that is when it happened.",
  },
];

export function HowItReadsSection() {
  return (
    <section className="py-20">
      <SectionView section="analytics_how_it_reads" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">Under the hood</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">How the page reads a stream.</h2>
          <p className="mt-4 text-muted-foreground">
            Every number on this page comes from three sources: a viewer count sample every five
            minutes, the Twitch events on your channel, and the category you were streaming under.
            Here is exactly how they turn into a verdict.
          </p>
        </div>

        <RevealGroup
          className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3"
          items={SOURCES.map(({ icon: Icon, title, body }) => ({
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

        <Reveal className="mx-auto mt-16 max-w-5xl">
          <p className="mb-6 text-center font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Two example reads
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {READS.map(({ title, body }) => (
              <article
                key={title}
                className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-6"
              >
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
