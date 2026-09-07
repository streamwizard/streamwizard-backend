import { LayoutGrid, MessageSquare, SlidersHorizontal, Type } from "lucide-react";
import { SectionView } from "@/components/public/analytics/section-view";
import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { Reveal } from "@/components/public/home/reveal";
import { CheckItem } from "@/components/public/layout/check-item";
import { docsLink } from "@/lib/constant";

/*
 * The deck in detail. The playable one is already further up the page, so this
 * section is the part a demo cannot show: what each tab owns, why scenes are
 * not on it, and what tapping a scene tile does to the auto switcher.
 */

const TABS = [
  {
    icon: LayoutGrid,
    name: "Deck",
    body: "Go live, end the stream, and a grid of scene tiles big enough to hit while walking. Start and stop the cloud OBS itself from here too, with a boot stepper while it comes up.",
  },
  {
    icon: MessageSquare,
    name: "Chat",
    body: (
      <>
        Read your Twitch chat and reply to it, with{" "}
        <TrackedLink
          href="https://7tv.app"
          cta="emotes_7tv"
          section="deck"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground/80 underline decoration-white/30 underline-offset-2 transition-colors hover:text-foreground"
        >
          7TV
        </TrackedLink>
        ,{" "}
        <TrackedLink
          href="https://betterttv.com"
          cta="emotes_bttv"
          section="deck"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground/80 underline decoration-white/30 underline-offset-2 transition-colors hover:text-foreground"
        >
          BetterTTV
        </TrackedLink>{" "}
        and{" "}
        <TrackedLink
          href="https://www.frankerfacez.com"
          cta="emotes_ffz"
          section="deck"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground/80 underline decoration-white/30 underline-offset-2 transition-colors hover:text-foreground"
        >
          FrankerFaceZ
        </TrackedLink>{" "}
        emotes rendered next to Twitch&apos;s own.
      </>
    ),
  },
  {
    icon: Type,
    name: "Stream info",
    body: "Change your title and your category between locations, without opening a browser or asking a mod to do it.",
  },
  {
    icon: SlidersHorizontal,
    name: "Sensitivity",
    body: "The three auto switcher presets and the full custom matrix. Scenes stay on the dashboard on purpose: this tab is for what you change while moving.",
  },
];

export function DeckSection() {
  return (
    <section className="py-20">
      <SectionView section="deck" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            The whole control room. <br /> One thumb.
          </h2>
          <p className="mt-4 text-muted-foreground">
            The deck opens in your browser and installs to your home screen like an app. Four tabs, tiles you can hit
            without looking, and zoom locked so fast tapping never fights you.
          </p>
        </div>

        <div className="mx-auto max-w-5xl">
          <div className="grid gap-4 sm:grid-cols-2">
            {TABS.map(({ icon: Icon, name, body }, i) => (
              <Reveal key={name} delay={(i % 2) * 0.05}>
                <div className="h-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10">
                      <Icon className="h-4 w-4 text-purple-300" aria-hidden="true" />
                    </span>
                    <h3 className="text-base font-semibold">{name}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-4">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
              <h3 className="text-xl font-semibold">Tap a scene and the switcher stands down</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Cutting to your BRB screen only to be dragged back two seconds later is the worst thing an auto switcher
                can do to you. So tapping a tile is a hold: the scene goes up and the switcher waits. A card tells you
                what you are holding and gives you the button to let go.
              </p>
              <ul className="mt-5 space-y-3">
                <CheckItem>Hold for 15 minutes, an hour, or until you release it yourself.</CheckItem>
                <CheckItem>
                  Let go and the switcher starts counting from zero, so it has to earn the live scene back the same way
                  it always does.
                </CheckItem>
                <CheckItem>
                  Scene changes made anywhere show up everywhere: the deck, the OBS window in your browser, and OBS
                  itself.
                </CheckItem>
              </ul>
              <p className="mt-6 text-sm text-muted-foreground">
                Setting it up takes a minute.{" "}
                <TrackedLink
                  href={`${docsLink}/irl/deck`}
                  cta="read_deck_docs"
                  section="deck"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 transition-colors hover:text-purple-200"
                >
                  Read the deck docs
                </TrackedLink>
                .
              </p>
            </div>
          </Reveal>
        </div>
      </SectionView>
    </section>
  );
}
