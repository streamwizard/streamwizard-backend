import { FaDiscord } from "react-icons/fa";
import { SectionView } from "@/components/public/analytics/section-view";
import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { Reveal } from "@/components/public/home/reveal";
import { discordInviteLink } from "@/lib/constant";
import { TicketFlow } from "./ticket-flow";

const STEPS = [
  {
    number: "01",
    text: "Join the Discord and hit the Create Ticket button. It sits in its own channel, hard to miss.",
  },
  {
    number: "02",
    text: "Say what broke or what you want. Pick Bug, Feature, Support or Other.",
  },
  {
    number: "03",
    text: "You get a private channel, just you and staff. Bugs worth tracking get moved to a public GitHub issue, so you can watch the fix land.",
  },
];

export function TicketSection() {
  return (
    <section className="py-20">
      <SectionView section="contact_ticket" className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            One button, one private channel.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            No forms, no email chains. The whole thing happens in Discord.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl items-center gap-8 md:grid-cols-2">
          <Reveal direction="left">
            <TicketFlow />
          </Reveal>
          <Reveal direction="right">
            <ol className="space-y-6">
              {STEPS.map((step) => (
                <li key={step.number} className="flex gap-4">
                  <span className="shrink-0 font-mono text-sm text-purple-300">{step.number}</span>
                  <p className="text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 rounded-md border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-muted-foreground">
              More detail means a faster fix. Screenshots, a video, a clip of your stream at the
              moment it broke. Whatever you think helps us find the problem, throw it in the
              ticket.
            </div>
            <TrackedLink
              href={discordInviteLink}
              cta="join_discord"
              section="contact_ticket"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-md border border-border bg-transparent px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <FaDiscord className="h-4 w-4" aria-hidden="true" />
              Open a ticket in Discord
            </TrackedLink>
          </Reveal>
        </div>

        <Reveal>
          <p className="mx-auto mt-12 max-w-2xl text-center text-sm text-muted-foreground">
            Every ticket gets answered by a human. No bots, no canned replies.
          </p>
        </Reveal>
      </SectionView>
    </section>
  );
}
