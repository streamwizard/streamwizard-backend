import Image from "next/image";
import { TrackedLink } from "../analytics/tracked-link";
import { FaDiscord } from "react-icons/fa";
import { BorderBeam } from "@repo/ui";
import TwitchLogin from "@/components/buttons/twitch-login";
import { discordInviteLink } from "@/lib/constant";

/*
 * Entrances are tailwindcss-animate utilities with fill-mode-backwards so the
 * staggered items start hidden. motion-reduce disables all of it.
 */
export function Hero() {
  return (
    <section className="relative pt-16 md:pt-20">
      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards text-4xl font-bold tracking-tight duration-700 motion-reduce:animate-none sm:text-5xl md:text-6xl">
            Streamer tools, <br /> duct-taped together.
          </h1>
          <p className="animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards mx-auto mt-6 max-w-2xl text-lg text-muted-foreground delay-150 duration-700 motion-reduce:animate-none sm:text-xl">
            Cloud OBS, overlays, clip management, and stream analytics for Twitch. Open source and
            built in public.
          </p>
          <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards mt-8 flex flex-wrap items-center justify-center gap-3 delay-300 duration-700 motion-reduce:animate-none">
            <TwitchLogin redirect="/dashboard" text="Connect Twitch" variant="default" size="lg" source="landing_hero" />
            <TrackedLink
              href={discordInviteLink}
              cta="join_discord"
              section="hero"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-transparent px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <FaDiscord className="h-4 w-4" aria-hidden="true" />
              Join the Discord
            </TrackedLink>
          </div>
        </div>

        <div className="animate-in fade-in fill-mode-backwards relative z-10 mt-16 rounded-xl delay-200 duration-1000 [--animation-delay:200ms] before:pointer-events-none before:absolute before:-z-10 before:content-[''] before:[inset:-5rem] before:bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--color-three),transparent_70%),transparent_70%)] before:opacity-50 before:filter-[blur(120px)] after:pointer-events-none after:absolute after:inset-0 after:z-50 after:rounded-[inherit] after:bg-[linear-gradient(to_top,var(--background)_10%,transparent_60%)] after:content-[''] motion-reduce:animate-none">
          {/* Real intrinsic dimensions so the browser reserves space from the aspect ratio. LCP element. */}
          <Image
            src="/img/landing-page/hero-dark.webp"
            alt="The StreamWizard dashboard with the clip library open: search, filters, folders, and a grid of synced Twitch clips"
            width={2539}
            height={1271}
            /* Not 100vw: this sits in `container mx-auto px-4`, which caps at
               96rem, so the real render width is min(100vw - 2rem, 1504px).
               Claiming the full viewport made wide DPR-1 monitors pull the
               2539px source to paint 1504px of it, on the LCP element. */
            sizes="(min-width: 1536px) 1504px, calc(100vw - 2rem)"
            className="h-auto w-full rounded-xl"
            priority
          />
          <span className="motion-reduce:hidden">
            <BorderBeam size={250} duration={12} delay={9} />
          </span>
        </div>
      </div>
    </section>
  );
}
