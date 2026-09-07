import { SectionView } from "@/components/public/analytics/section-view";
import { Reveal } from "@/components/public/home/reveal";
import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { discordInviteLink, githubLink } from "@/lib/constant";
import { BuildLog } from "./build-log";

const linkClass =
  "text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground";

/*
 * The open source story, with a build log beside it. The log mirrors the
 * origin section's layout: visual on the left this time, so the page
 * alternates instead of repeating itself.
 */
export function BuiltInPublicSection() {
  return (
    <section className="py-20">
      <SectionView section="built_in_public" className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            The work happens where you can see it.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">Open source, no stealth mode.</p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl items-center gap-8 md:grid-cols-2">
          <Reveal direction="left" className="md:order-first">
            <BuildLog />
          </Reveal>
          <Reveal direction="right" className="space-y-4 text-muted-foreground">
            <p>
              The code is on{" "}
              <TrackedLink
                href={githubLink}
                cta="github"
                section="built_in_public"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                GitHub
              </TrackedLink>{" "}
              under an MIT license. Anyone can read it, fork it or fix it.
            </p>
            <p>
              Bugs usually get found by streamers before they get found by tests. Most of that
              happens in the{" "}
              <TrackedLink
                href={discordInviteLink}
                cta="discord"
                section="built_in_public"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Discord
              </TrackedLink>
              , where the person answering is the person who wrote the bug.
            </p>
          </Reveal>
        </div>
      </SectionView>
    </section>
  );
}
