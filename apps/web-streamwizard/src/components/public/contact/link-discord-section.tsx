import { SectionView } from "@/components/public/analytics/section-view";
import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { Reveal } from "@/components/public/home/reveal";

/*
 * Why linking Discord to StreamWizard matters for support: the ticket embed
 * shows staff which account the opener belongs to. The card on the right
 * echoes the account line from the ticket mock above it.
 */
export function LinkDiscordSection() {
  return (
    <section className="py-20">
      <SectionView section="contact_link_discord" className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Link your Discord first.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            So we know which account is yours.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl items-center gap-8 md:grid-cols-2">
          <Reveal direction="left" className="space-y-4 text-muted-foreground">
            <p>
              Tickets work without it. They work a lot better with it. When your Discord is linked
              to StreamWizard, your ticket opens with your account already attached, so staff can
              see who you are and which account is acting up instead of playing twenty questions.
            </p>
            <p>
              It comes with perks too. Linked members get the Verified Member role, access to the
              collab channels, and the server posts a notification when you go live. Link it from
              your dashboard settings, or type{" "}
              <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-sm text-foreground">
                /link
              </code>{" "}
              in the Discord and the bot sends you the same page.
            </p>
            <TrackedLink
              href="/dashboard/settings/integrations"
              cta="link_discord"
              section="contact_link_discord"
              className="mt-2 inline-flex h-10 items-center gap-2 rounded-md border border-border bg-transparent px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Link your Discord
            </TrackedLink>
          </Reveal>
          <Reveal direction="right">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                What staff sees
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-md border-l-2 border-white/[0.12] bg-white/[0.03] p-3 text-muted-foreground">
                  ❌ Not linked
                </div>
                <div className="rounded-md border-l-2 border-purple-400/70 bg-white/[0.04] p-3">
                  ✅ Linked — WizardFan (wizard@…)
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                One of these gets your problem fixed faster.
              </p>
            </div>
          </Reveal>
        </div>
      </SectionView>
    </section>
  );
}
