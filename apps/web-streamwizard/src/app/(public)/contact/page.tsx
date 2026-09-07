import type { Metadata } from "next";
import { FaDiscord } from "react-icons/fa";
import { absoluteUrl } from "@/lib/seo";
import { discordInviteLink } from "@/lib/constant";
import { PageHero } from "@/components/public/layout/page-hero";
import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { TicketSection } from "@/components/public/contact/ticket-section";
import { LinkDiscordSection } from "@/components/public/contact/link-discord-section";
import { IdeasSection } from "@/components/public/contact/ideas-section";
import { ChannelsSection } from "@/components/public/contact/channels-section";
import { FinalCta } from "@/components/public/home/final-cta";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "The fastest way to reach StreamWizard is a ticket in the Discord: one button, one private channel with the people who wrote the code. GitHub issues and docs cover the rest.",
  alternates: { canonical: absoluteUrl("/contact") },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <PageHero
        eyebrow="Contact"
        title={
          <>
            Come say hi <br /> in the Discord.
          </>
        }
        lede="The support queue is a Discord channel. Hit Create Ticket and you get a private channel with the people who wrote the code. Usually within the hour, not within five business days."
      />

      <div className="container mx-auto mt-8 flex justify-center px-4">
        <TrackedLink
          href={discordInviteLink}
          cta="join_discord"
          section="hero"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <FaDiscord className="h-4 w-4" aria-hidden="true" />
          Join the Discord
        </TrackedLink>
      </div>

      <TicketSection />
      <LinkDiscordSection />
      <IdeasSection />
      <ChannelsSection />
      <FinalCta />
    </div>
  );
}
