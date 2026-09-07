import { TrackedLink } from "../analytics/tracked-link";
import { FaDiscord, FaGithub } from "react-icons/fa";
import { BsTwitch } from "react-icons/bs";
import { discordInviteLink, githubLink, twitchChannelLink } from "@/lib/constant";

/*
 * The honest trust story: no user counts to brag about, so the section leans
 * on what is verifiably true. Facts only, no numbers.
 */
const items = [
  {
    icon: FaGithub,
    label: "Open source on GitHub",
    href: githubLink,
    cta: "github",
  },
  {
    icon: BsTwitch,
    label: "Built in public on Twitch",
    href: twitchChannelLink,
    cta: "twitch",
  },
  {
    icon: FaDiscord,
    label: "Community on Discord",
    href: discordInviteLink,
    cta: "discord",
  },
];

export function TrustBand() {
  return (
    <section className="relative py-12">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {items.map(({ icon: Icon, label, href, cta }) =>
            href ? (
              <TrackedLink
                key={label}
                href={href}
                cta={cta}
                section="trust_band"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </TrackedLink>
            ) : (
              <span key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </span>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
