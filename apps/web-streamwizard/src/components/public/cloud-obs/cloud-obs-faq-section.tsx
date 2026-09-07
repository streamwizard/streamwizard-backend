import { SectionView } from "@/components/public/analytics/section-view";
import { Reveal } from "@/components/public/home/reveal";
import { FaqAccordion } from "@/components/public/home/faq-accordion";
import { PRICING_FAQ_LINK } from "@/lib/pricing";

/*
 * The page's FAQ, and the last stop before the beta note. It answers the
 * objections the sections above cannot: no PC at home, what you stream with,
 * whether a stopped container eats your scenes, and whether this is real OBS.
 * The cost answer is one sentence and points at /pricing (SW-303); the beta
 * note underneath carries the Discord route.
 * Its own section id so the funnel dashboard can tell it apart from the home
 * FAQ. CLOUD_OBS_FAQ_ITEMS also feeds the page's FAQPage JSON-LD, so answers
 * must stand on their own: AI answers quote them without the page around them.
 */

export const CLOUD_OBS_FAQ_ITEMS = [
  {
    question: "Do I need a PC running at home?",
    answer:
      "No. OBS runs in a container in the cloud, on our machines, and it is the thing streaming to Twitch. Your phone only sends video to the ingest. It can drop to one bar, switch networks or run out of battery, and your Twitch stream stays up on the fallback scene.",
  },
  {
    question: "What do I stream from the street with?",
    answer:
      "Any app or encoder that speaks SRT or SRTLA. A streaming app on your phone, or a bonding encoder like Belabox, Moblin or IRLToolkit. One connection goes to the SRT URL, several at once go to the SRTLA one, and both use the same key.",
  },
  {
    question: "How long is the delay?",
    answer:
      "Around 10 seconds from your camera to a viewer's screen. Your encoder holds an SRT latency buffer, 2.5 seconds on the usual defaults, the ingest holds 4 more, and Twitch adds its own on top. That buffer is the point: it swallows the packets a tower handover loses, so a rough minute of walking arrives as normal video instead of a stutter, and the switcher still has good frames to play with while it decides.",
  },
  {
    question: "Is it real OBS, or your version of it?",
    answer:
      "Real OBS. You open a window in your browser and you are looking at the actual OBS running in your container, scene list and all. Browser sources from any alert provider work the same as they do at home, so bring the overlays you already use.",
  },
  {
    question: "Do I lose my scenes when I stop the container?",
    answer:
      "No. Scenes, sources and uploaded files live on your container and come back the next time you start it. Stop it between streams so it is not sitting there running while you sleep.",
  },
  {
    question: "What does it cost?",
    answer:
      "Cloud OBS, the ingest server and the deck are the paid part of StreamWizard, in invite-only beta right now, so access goes out by hand in Discord.",
    link: PRICING_FAQ_LINK,
  },
] as const;

export function CloudObsFaqSection() {
  return (
    <section className="py-20">
      <SectionView section="cloud_obs_faq" className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Before you launch a container.</h2>
          <p className="mt-4 text-muted-foreground">What you need, what persists, and what it costs.</p>
        </div>

        <Reveal>
          <div className="mx-auto max-w-3xl">
            <FaqAccordion items={CLOUD_OBS_FAQ_ITEMS} />
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
