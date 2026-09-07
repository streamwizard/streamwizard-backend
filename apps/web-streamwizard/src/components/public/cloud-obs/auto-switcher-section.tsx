import { SectionView } from "@/components/public/analytics/section-view";
import { CheckItem } from "@/components/public/layout/check-item";
import { Reveal } from "@/components/public/home/reveal";
import { DeckSensitivityMock } from "./deck-sensitivity-mock";
import { SwitcherFlow } from "./switcher-flow";

/*
 * The auto switcher, which is the reason most IRL streamers pay for anything.
 * The demo does the explaining, and the deck row underneath shows the same
 * sensitivity surface from the phone.
 */

export function AutoSwitcherSection() {
  return (
    <section id="auto-switcher" className="scroll-mt-24 py-20">
      <SectionView section="auto_switcher" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">The auto switcher</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            You walk under a bridge. <br /> Chat never sees the frozen frame.
          </h2>
          <p className="mt-4 text-muted-foreground">
            It watches the signal arriving at your ingest and moves your OBS to a fallback scene when the connection
            goes bad, then comes back once it is properly stable. Here it is doing exactly that, once a second, on a
            walk that goes wrong. Or grab a slider and break the signal yourself.
          </p>
        </div>

        <Reveal direction="scale">
          <SwitcherFlow />
        </Reveal>

        <div className="mt-20 grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal direction="left" className="order-2 lg:order-1">
            <div className="mx-auto w-fit">
              <DeckSensitivityMock />
            </div>
          </Reveal>
          <Reveal direction="right" className="order-1 lg:order-2">
            <h3 className="text-xl font-semibold">Retune from your pocket</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Sensitivity lives on the deck too. This one is wired to the switcher above, so what you tap here retunes
              the demo live.
            </p>
            <ul className="mt-6 space-y-3">
              <CheckItem>
                Changes land mid-stream. The switcher picks them up within a second, and your stream and ingest never
                restart.
              </CheckItem>
              <CheckItem>
                Retune for where you are: Relaxed for the woods where dead spots are normal, Fast for the city where a
                single frozen frame stands out.
              </CheckItem>
              <CheckItem>Pick a preset or flip advanced mode here and the switcher above follows.</CheckItem>
              <CheckItem>Tap a scene on the deck and it goes on air. The switcher stands down until you let go.</CheckItem>
            </ul>
          </Reveal>
        </div>

        <Reveal>
          <p className="mx-auto mt-14 max-w-2xl text-center text-sm text-muted-foreground">
            Scenes are tracked by their id inside OBS, not their name, so renaming a scene months later does not quietly
            break your switcher.
          </p>
        </Reveal>
      </SectionView>
    </section>
  );
}
