import { SectionView } from "../analytics/section-view";
import { Reveal } from "../home/reveal";
import { FaqAccordion } from "../home/faq-accordion";

/*
 * The page's FAQ, which is also where the setup story lives now: one browser
 * source, the no-refresh socket, the free story, and the no-code answer. Its
 * own section id so the funnel dashboard can tell it apart from the home FAQ;
 * no JSON-LD, the FAQPage schema stays a home-page-only thing.
 */

const OVERLAY_FAQ_ITEMS = [
  {
    question: "How do I get this into OBS?",
    answer:
      "Add one browser source, paste your overlay's URL, set it to 1920 by 1080. That is the whole setup. Works in the OBS on your PC and in cloud OBS, same URL either way.",
  },
  {
    question: "Do I have to refresh the source when I change something?",
    answer:
      "No. Changes ride a WebSocket into the running source, so you can swap your alert gif mid-stream and it just lands. Swapping to a completely different layout is the one time you refresh.",
  },
  {
    question: "What does it cost?",
    answer:
      "Nothing. The alert box, the editor, the widget library and custom widgets are free, no plan required. The only quota is media storage: 10MB per file, 100MB total on the free tier.",
  },
  {
    question: "Do I need to know how to code?",
    answer:
      "No. The built-in widgets are settings, not code, and the public library is other people's widgets behind an install button. Code only enters the picture when you want to build a custom widget yourself, and then the editor gives you HTML, JavaScript, Tailwind and GSAP with a live preview, so an animated widget is a few lines instead of a pile of keyframes.",
  },
] as const;

export function OverlaysFaqSection() {
  return (
    <section className="py-20">
      <SectionView section="overlays_faq" className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Before you paste the URL.</h2>
          <p className="mt-4 text-muted-foreground">Setup, cost, and whether you need to code.</p>
        </div>

        <Reveal>
          <div className="mx-auto max-w-3xl">
            <FaqAccordion items={OVERLAY_FAQ_ITEMS} />
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
