import { FaDiscord } from "react-icons/fa";
import TwitchLogin from "@/components/buttons/twitch-login";
import { SectionView } from "@/components/public/analytics/section-view";
import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { RevealGroup } from "@/components/public/home/reveal";
import { CheckItem } from "@/components/public/layout/check-item";
import { discordInviteLink, productLinks } from "@/lib/constant";
import { FREE_MEDIA_QUOTA_MB, FREE_TIER_SUMMARY, PAID_PLAN_SUMMARY } from "@/lib/pricing";

/*
 * The two things you can have: the free tools and the Cloud OBS plan. Two
 * cards, no third column, because a third column would be a lie. The Cloud
 * OBS card carries no number on purpose: there is no public price yet, and a
 * placeholder would be quoted by AI answers as if it were real.
 *
 * Every Cloud OBS bullet matches an entry in the SoftwareApplication
 * featureList in lib/seo.ts, so nothing here is aspirational.
 */

const FREE_FEATURES = [
  "Twitch clip sync with nested folders and stacking filters",
  "Alert box, overlay editor, widget library and custom widgets",
  "VOD clipping: 5 to 60 second clips off the marked timeline",
  "Per-stream analytics with follows, subs and clips on the viewer graph",
  `${FREE_MEDIA_QUOTA_MB}MB of media storage for overlay assets`,
  "Open source under the MIT license",
] as const;

const CLOUD_OBS_FEATURES = [
  "A dedicated OBS for your channel in the cloud, streamed into over SRT or SRTLA",
  "SRTLA ingest that bonds several mobile connections into one stream",
  "The deck on your phone: go live, switch scenes, set title and category",
  "Auto switcher that swaps to a fallback scene when the connection goes bad",
  "Access by invite while it is in beta",
] as const;

function FreeCard() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
      <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Free</p>
      <p className="mt-3 text-4xl font-bold tracking-tight">€0</p>
      <p className="mt-1 text-sm text-muted-foreground">No card, no trial clock.</p>
      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
        {FREE_TIER_SUMMARY.charAt(0).toUpperCase() + FREE_TIER_SUMMARY.slice(1)}, behind one Twitch
        login.
      </p>
      <ul className="mt-6 space-y-3">
        {FREE_FEATURES.map((feature) => (
          <CheckItem key={feature}>{feature}</CheckItem>
        ))}
      </ul>
      <div className="mt-8 flex flex-1 items-end">
        <TwitchLogin redirect="/dashboard" text="Connect Twitch" variant="default" size="lg" source="pricing_free" />
      </div>
    </div>
  );
}

function CloudObsCard() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-purple-500/30 bg-purple-500/[0.06] p-6 sm:p-8">
      <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">Cloud OBS · Paid · Beta</p>
      <p className="mt-3 text-4xl font-bold tracking-tight">Price not public yet</p>
      <p className="mt-1 text-sm text-muted-foreground">Prices land with the plan story.</p>
      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{PAID_PLAN_SUMMARY}</p>
      <ul className="mt-6 space-y-3">
        {CLOUD_OBS_FEATURES.map((feature) => (
          <CheckItem key={feature}>{feature}</CheckItem>
        ))}
      </ul>
      <div className="mt-8 flex flex-1 flex-wrap items-end gap-3">
        <TrackedLink
          href={discordInviteLink}
          cta="beta_discord"
          section="pricing_plans"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <FaDiscord className="h-4 w-4" aria-hidden="true" />
          Ask for beta access
        </TrackedLink>
        <TrackedLink
          href={productLinks.cloudObs}
          cta="cloud_obs"
          section="pricing_plans"
          className="inline-flex h-10 items-center rounded-md border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          See what Cloud OBS does
        </TrackedLink>
      </div>
    </div>
  );
}

export function PlansSection() {
  return (
    <section className="py-16 md:py-20">
      <SectionView section="pricing_plans" className="container mx-auto px-4">
        <RevealGroup
          className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2"
          items={[{ node: <FreeCard /> }, { node: <CloudObsCard /> }]}
        />
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
          No hidden tiers. No Pro. Nothing on the free side is a trial.
        </p>
      </SectionView>
    </section>
  );
}
