import { FaDiscord } from "react-icons/fa";
import { BookOpen } from "lucide-react";
import { Button } from "@repo/ui";
import { discordInviteLink, docsLink } from "@/lib/constant";
import { Reveal } from "./reveal";
import { FaqAccordion } from "./faq-accordion";
import { TrackedLink } from "../analytics/tracked-link";
import { SectionView } from "../analytics/section-view";

/*
 * The questions a streamer actually asks before connecting a Twitch account,
 * answered against what the product does today: what is paid (Cloud OBS, the
 * ingest server and the deck), what is not, what happens to their existing
 * clips, and why the OAuth screen asks for so much.
 *
 * FAQ_ITEMS is also the source for the FAQPage JSON-LD on the home page
 * (lib/seo.ts), so answers must stay self-contained: search and AI answers
 * quote them without the surrounding page. The last item is a joke and is
 * rendered only, never fed to the schema: a rich result is a bad place for a
 * bit.
 */

export const FAQ_ITEMS = [
  {
    question: "Do I have to install anything?",
    answer:
      "No. Clips, folders, overlays, VOD clipping and analytics all run in the browser, and you sign in with Twitch. Overlays are a browser source you paste into the OBS you already use. Cloud OBS is the exception in the other direction: it runs on our machines, so there is nothing to install for that either.",
  },
  {
    question: "Is it free?",
    answer:
      "Mostly. Clip sync, clip folders, VOD clipping, overlays and stream analytics are free. Cloud OBS, the ingest server and the phone deck that drives them need a paid plan. StreamWizard is also open source under the MIT license, so you can read every line or run it yourself.",
  },
  {
    question: "What happens to the clips I already have?",
    answer:
      "They come with you. StreamWizard pulls in your channel's clips, back catalogue included, then keeps up automatically: new clips land the moment your stream ends, so there is nothing to sync by hand. Sorting them into folders is up to you.",
  },
  {
    question: "How soon do I see my analytics?",
    answer:
      "From your next stream. Twitch does not hand out minute-by-minute history, so StreamWizard starts recording viewers, follows, subs, raids and clips the moment you go live, and the breakdown is ready when the stream ends. Nothing is backfilled from before you connected.",
  },
  {
    question: "I do not want to look at my numbers. Can I turn them off?",
    answer:
      "Yes. Show stream stats is one switch in Settings, and we ask about it during setup. Turn it off and the analytics page goes away, with your clips as the page you land on instead. Turn it back on whenever.",
  },
  {
    question: "Why does Twitch ask for so many permissions?",
    answer:
      "Every scope maps to a feature you can see: reading clips and VODs to sync them, reading follows, subs, cheers and raids to build your stream timeline, chat access for the bot and the deck's chat tab, and stream title and category access so you can change them from your phone. You can revoke access from your Twitch connection settings at any time, and StreamWizard stops.",
  },
  {
    question: "Do I need to be an IRL streamer for this?",
    answer:
      "No. Clips, folders, overlays, VOD clipping and analytics do not care where you stream from. Cloud OBS is the part built specifically for going live away from your PC.",
  },
  {
    question: "Something broke. Where do I go?",
    answer:
      "Discord is the fastest route, and the docs cover setup for each part. It is a small project built in public, so bug reports usually reach the person who wrote the bug.",
  },
] as const;

/* Rendered after the real ones, kept out of FAQ_ITEMS on purpose. */
const CLOSING_ITEM = {
  question: "Do people actually ask these?",
  answer:
    "Probably not. Most of them are questions we asked ourselves at 2am while building the thing. If yours is not up there, Discord is one click away.",
} as const;

export function Faq() {
  return (
    <section className="py-20">
      <SectionView section="faq" className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Questions, answered.</h2>
          <p className="mt-4 text-muted-foreground">
            What it costs, what it touches, and what happens to the clips you already have.
          </p>
        </div>

        <Reveal>
          <div className="mx-auto max-w-3xl">
            <FaqAccordion items={[...FAQ_ITEMS, CLOSING_ITEM]} />

            {/* Lifted a notch above the accordion: this is the way out of the
                page for anyone whose question is not up there. */}
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="w-full gap-2 px-7 shadow-lg shadow-purple-500/20 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-500/30 sm:w-auto"
              >
                <TrackedLink href={discordInviteLink} cta="ask_in_discord" section="faq" target="_blank" rel="noopener noreferrer">
                  <FaDiscord className="size-5" aria-hidden="true" />
                  Ask in Discord
                </TrackedLink>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full gap-2 border-white/20 bg-white/[0.04] px-7 shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/[0.08] sm:w-auto"
              >
                <TrackedLink href={docsLink} cta="read_docs" section="faq" target="_blank" rel="noopener noreferrer">
                  <BookOpen className="size-5" aria-hidden="true" />
                  Read the docs
                </TrackedLink>
              </Button>
            </div>
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
