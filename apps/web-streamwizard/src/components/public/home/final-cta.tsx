import { TrackedLink } from "../analytics/tracked-link";
import { SectionView } from "../analytics/section-view";
import { FaDiscord, FaGithub } from "react-icons/fa";
import TwitchLogin from "@/components/buttons/twitch-login";
import { discordInviteLink, githubLink } from "@/lib/constant";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="py-20 md:py-28">
      <SectionView section="final_cta" className="container mx-auto px-4">
        <Reveal direction="scale">
          <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-14 text-center sm:px-10 md:py-20">
            {/* Ambient glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 -top-24 h-64 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_srgb,var(--color-three),transparent_78%),transparent_100%)] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-2"
            />
            <div className="relative">
              <h2 className="mx-auto max-w-xl text-3xl font-bold sm:text-4xl">
                Sign in and poke around.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-muted-foreground">
                Log in with Twitch, no card needed. Clips, overlays, and analytics are free and open
                source.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <TwitchLogin
                  redirect="/dashboard"
                  text="Connect Twitch"
                  variant="default"
                  size="lg"
                  source="landing_final_cta"
                />
                <TrackedLink
                  href={githubLink}
                  cta="star_on_github"
                  section="final_cta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-transparent px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <FaGithub className="h-4 w-4" aria-hidden="true" />
                  Star on GitHub
                </TrackedLink>
                <TrackedLink
                  href={discordInviteLink}
                  cta="join_discord"
                  section="final_cta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-transparent px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <FaDiscord className="h-4 w-4" aria-hidden="true" />
                  Join the Discord
                </TrackedLink>
              </div>
            </div>
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
