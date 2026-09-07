import { SectionView } from "@/components/public/analytics/section-view";
import { FaqAccordion } from "@/components/public/home/faq-accordion";
import { Reveal } from "@/components/public/home/reveal";
import { FREE_MAX_FILE_MB, FREE_MEDIA_QUOTA_MB } from "@/lib/pricing";

/*
 * The money questions, in the order people ask them in Discord. This is the
 * page every other "What does it cost?" FAQ points at, so the answers are the
 * long form and stand on their own: PRICING_FAQ_ITEMS also feeds the page's
 * FAQPage JSON-LD, and AI answers quote them without the page around them.
 * The quota numbers come from lib/pricing.ts, which mirrors actions/assets.ts.
 */

export const PRICING_FAQ_ITEMS = [
  {
    question: "Is StreamWizard free?",
    answer:
      "Mostly. Clip sync, clip folders, overlays, VOD clipping and stream analytics are free with a Twitch login, no card. Cloud OBS, the ingest server and the deck are a separate paid plan. All of it is open source under the MIT license.",
  },
  {
    question: "What does Cloud OBS cost?",
    answer:
      "There is no public price yet. Cloud OBS is in beta and access goes out by hand through the StreamWizard Discord. Prices land with the plan story. It will not be free: every channel gets its own OBS on a server, and that server costs money for as long as you are live.",
  },
  {
    question: "Are there hidden tiers or a Pro plan?",
    answer:
      "No. There are two things: the free tools and the Cloud OBS plan. Nothing on the free side is a trial, and nothing is capped to push you onto a paid plan.",
  },
  {
    question: "What are the limits on the free tier?",
    answer:
      `The only quota is media storage for overlay assets: ${FREE_MAX_FILE_MB}MB per file, ${FREE_MEDIA_QUOTA_MB}MB total. Clip sync, folders, VOD clipping and analytics have no caps.`,
  },
  {
    question: "Can I run it myself instead of paying?",
    answer:
      "Yes. StreamWizard is MIT licensed on GitHub, so you can read every line or run it on your own server. You pay the server bill instead of us.",
  },
] as const;

export function PricingFaqSection() {
  return (
    <section className="py-20">
      <SectionView section="pricing_faq" className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Before you ask in Discord.</h2>
          <p className="mt-4 text-muted-foreground">What is free, what is not, and what the limits are.</p>
        </div>

        <Reveal>
          <div className="mx-auto max-w-3xl">
            <FaqAccordion items={PRICING_FAQ_ITEMS} />
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
