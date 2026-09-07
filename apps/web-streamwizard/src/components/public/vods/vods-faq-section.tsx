import { SectionView } from "../analytics/section-view";
import { Reveal } from "../home/reveal";
import { FaqAccordion } from "../home/faq-accordion";

/*
 * The page's FAQ, and the canonical home of the honest caveat: events are
 * recorded live, so VODs from before you connected have a bare timeline.
 * Its own section id so the funnel dashboard can tell it apart from the home
 * FAQ; no JSON-LD, the FAQPage schema stays a home-page-only thing.
 */

const VODS_FAQ_ITEMS = [
  {
    question: "Why is the timeline empty on my older VODs?",
    answer:
      "StreamWizard records events live, while it is connected to your channel. VODs from before you signed up play fine, they just have no dots on the timeline. From your next stream on, everything is marked.",
  },
  {
    question: "Why is chat not on the timeline?",
    answer:
      "Twitch's developer terms only let a service keep chat logs as long as it needs them to work, never to build chat archives. A chat replay next to your VOD would be exactly that, so StreamWizard keeps the events and drops the messages. The follow, the raid and the redemption are marked; the words around them are not stored.",
  },
  {
    question: "Are the clips real Twitch clips?",
    answer:
      "Yes. Saving a selection creates a clip on your Twitch channel with a normal shareable URL. Twitch takes a few seconds to render it, and it also lands in your StreamWizard clip library.",
  },
  {
    question: "Why 5 to 60 seconds?",
    answer:
      "That is Twitch's limit for clips, so the handles clamp to it. A save never fails for being too long or too short.",
  },
  {
    question: "What does it cost?",
    answer:
      "Nothing. VOD clipping is free, along with clip sync, folders, overlays and analytics. Cloud OBS is the paid part of StreamWizard, and none of this needs it.",
  },
] as const;

export function VodsFaqSection() {
  return (
    <section className="py-20">
      <SectionView section="vods_faq" className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-amber-300 uppercase">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Before you open the VOD.</h2>
          <p className="mt-4 text-muted-foreground">Old VODs, chat logs, real clips, and what it costs.</p>
        </div>

        <Reveal>
          <div className="mx-auto max-w-3xl">
            <FaqAccordion items={VODS_FAQ_ITEMS} />
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
