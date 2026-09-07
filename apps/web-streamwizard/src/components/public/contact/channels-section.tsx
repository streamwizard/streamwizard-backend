import Link from "next/link";
import { FaDiscord, FaGithub } from "react-icons/fa";
import { BookOpen } from "lucide-react";
import type { IconType } from "react-icons";
import type { LucideIcon } from "lucide-react";
import { SectionView } from "@/components/public/analytics/section-view";
import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { Reveal } from "@/components/public/home/reveal";
import { discordInviteLink, docsLink, githubLink } from "@/lib/constant";

const channels: {
  name: string;
  href: string;
  cta: string;
  icon: IconType | LucideIcon;
  blurb: string;
  action: string;
}[] = [
  {
    name: "Discord",
    href: discordInviteLink,
    cta: "discord",
    icon: FaDiscord,
    blurb:
      "Tickets, quick questions, and hanging out. The Create Ticket button lives here. Fastest answer you will get.",
    action: "Join the Discord",
  },
  {
    name: "GitHub issues",
    href: `${githubLink}/issues`,
    cta: "github_issues",
    icon: FaGithub,
    blurb:
      "Bugs with steps to reproduce, and feature requests you want tracked. Everything is public, so you can watch the fix land.",
    action: "Open an issue",
  },
  {
    name: "Docs",
    href: docsLink,
    cta: "docs",
    icon: BookOpen,
    blurb:
      "Setup guides for cloud OBS, the overlay editor, clip syncing and the deck. Worth a look before you ask, and often quicker.",
    action: "Read the docs",
  },
];

export function ChannelsSection() {
  return (
    <section className="py-16 md:py-20">
      <SectionView section="contact_channels" className="container mx-auto max-w-5xl px-4">
        <p className="mb-10 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          All the ways in
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel, index) => (
            <Reveal key={channel.href} delay={index * 0.05}>
              <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
                <channel.icon className="h-5 w-5 text-purple-300" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold">{channel.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {channel.blurb}
                </p>
                <TrackedLink
                  href={channel.href}
                  cta={channel.cta}
                  section="contact_channels"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-transparent px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  {channel.action}
                </TrackedLink>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.15}>
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted-foreground">
            Privacy requests, data deletion and anything else with legal weight are handled at the
            address on the{" "}
            <Link
              href="/privacy-policy"
              className="text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
            >
              privacy policy
            </Link>
            , not in Discord.
          </p>
        </Reveal>
      </SectionView>
    </section>
  );
}
