import { SectionView } from "@/components/public/analytics/section-view";
import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { discordInviteLink } from "@/lib/constant";

/*
 * Where the money conversation happens, since there is no pricing page yet.
 * Says paid and says beta, because a visitor who reads two thousand words of
 * detail and then discovers they cannot buy it has been wasted.
 */
export function BetaNote() {
  return (
    <section className="pt-8">
      <SectionView section="beta_note" className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 text-center sm:p-8">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">Beta</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Cloud OBS, the ingest server and the deck are a paid plan, and they are in beta. Access goes out by hand
            while we find the rough edges, so the way in is to{" "}
            <TrackedLink
              href={discordInviteLink}
              cta="beta_discord"
              section="beta_note"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-300 transition-colors hover:text-purple-200"
            >
              ask in Discord
            </TrackedLink>
            . Prices land with the plan story. Clips, overlays and analytics stay free and open source either way.
          </p>
        </div>
      </SectionView>
    </section>
  );
}
