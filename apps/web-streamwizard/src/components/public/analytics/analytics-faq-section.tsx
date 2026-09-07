import { SectionView } from "./section-view";
import { Reveal } from "../home/reveal";
import { FaqAccordion } from "../home/faq-accordion";
import { PRICING_FAQ_LINK } from "@/lib/pricing";

/*
 * The page's FAQ, and the canonical home of the honest caveat: tracking
 * starts when you connect, so streams from before StreamWizard have no data
 * to show. Its own section id for the funnel dashboard. ANALYTICS_FAQ_ITEMS
 * also feeds the page's FAQPage JSON-LD, so answers must stand on their own:
 * AI answers quote them without the page around them. The off-switch answer
 * must stay in step with AnalyticsStatsRow's copy (and SW-196). The cost
 * answer is one sentence pointing at /pricing (SW-303).
 */

export const ANALYTICS_FAQ_ITEMS = [
  {
    question: "Where is my last stream?",
    answer:
      "StreamWizard records while it is connected to your channel, starting the moment you go live. Streams from before you signed up cannot be reconstructed, so the first graph you see is your next stream, not your last one.",
  },
  {
    question: "Do you keep my chat?",
    answer:
      "No. Twitch's developer terms only let a service hold chat logs as long as it needs them to work, never to build archives. StreamWizard keeps the events: the follow, the raid, the redemption. The messages around them are not stored.",
  },
  {
    question: "How long do you keep my stream data?",
    answer:
      "Until you delete your account or disconnect Twitch. There is no rolling window: a stream from your first week on StreamWizard is still there a year later, viewer samples and events included. Deleting your account removes all of it, the samples, the events and the category rows, in one operation. Chat messages are never stored in the first place, so there is nothing to keep or purge there. If you want to stop recording without leaving, flip analytics off in Settings and the numbers go away. Everything lives on servers in the EU, alongside the rest of what StreamWizard stores for you.",
  },
  {
    question: "How is the best hour decided?",
    answer:
      "By a score with two halves. StreamWizard splits your stream into full hours and works out each hour's average viewers and its interactions: follows, subs, raids and channel point redemptions. Average viewers are divided by the best hour's average, interactions by the busiest hour's count, so both land between zero and one. Half of each, added together, is the hour's score, and the highest score wins. A quiet-viewers hour with a raid and a run of follows can beat the hour with the most people watching, which is the point: the hour worth clipping is not always the fullest one. The verdict under the chart says which half carried the win. Bits are shown per hour but do not count toward the score.",
  },
  {
    question: "Who can see my numbers?",
    answer:
      "You. The dashboard sits behind your Twitch login, and nothing from it is published anywhere. The demo on this page runs on made-up data, not on anyone's stream.",
  },
  {
    question: "What if I don't want analytics at all?",
    answer:
      "Then say no when onboarding asks, or flip the switch in Settings later. The numbers go away and your clips become the page you land on. Some streamers just want to stream, and that is a setting, not a lecture.",
  },
  {
    question: "What does it cost?",
    answer: "Nothing. Analytics is free and never needs Cloud OBS, the paid part of StreamWizard.",
    link: PRICING_FAQ_LINK,
  },
] as const;

export function AnalyticsFaqSection() {
  return (
    <section className="py-20">
      <SectionView section="analytics_faq" className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Before you check the numbers.</h2>
          <p className="mt-4 text-muted-foreground">
            When tracking starts, what gets stored and for how long, how the best hour is scored, who sees it, and
            what it costs.
          </p>
        </div>

        <Reveal>
          <div className="mx-auto max-w-3xl">
            <FaqAccordion items={ANALYTICS_FAQ_ITEMS} />
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
