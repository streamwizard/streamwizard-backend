import { SectionView } from "./section-view";
import { Reveal } from "../home/reveal";
import { FaqAccordion } from "../home/faq-accordion";

/*
 * The page's FAQ, and the canonical home of the honest caveat: tracking
 * starts when you connect, so streams from before StreamWizard have no data
 * to show. Its own section id for the funnel dashboard; no JSON-LD, the
 * FAQPage schema stays a home-page-only thing. The off-switch answer must
 * stay in step with AnalyticsStatsRow's copy (and SW-196).
 */

const ANALYTICS_FAQ_ITEMS = [
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
    answer:
      "Nothing. Analytics is free, along with clip sync, folders, overlays and VOD clipping. Cloud OBS is the paid part of StreamWizard, and none of this needs it.",
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
            When tracking starts, what gets stored, who sees it, and what it costs.
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
