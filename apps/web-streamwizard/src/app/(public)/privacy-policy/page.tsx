import { LegalNotice } from "@/components/legal/legal-notice";
import { LegalTabs } from "@/components/legal-tabs";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal";
import { absoluteUrl } from "@/lib/seo";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  // Suffix comes from the root layout's title template.
  title: "Privacy Policy",
  description:
    "How StreamWizard collects, uses, and protects your personal data.",
  alternates: { canonical: absoluteUrl("/privacy-policy") },
};

const LAST_UPDATED = "29 August 2026";
const CONTACT_EMAIL = LEGAL_CONTACT_EMAIL;

function NormalContent() {
  return (
    <>
      <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-12">
        Last updated: {LAST_UPDATED}
      </p>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">1. Who We Are</h2>
        <p className="text-muted-foreground leading-relaxed">
          StreamWizard is a Twitch stream management tool that helps streamers
          organise clips, manage overlays, and interact with their audience. The
          service is operated by J. van der Wit and can be contacted at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
          >
            {CONTACT_EMAIL}
          </a>
          . Our servers are hosted at Hetzner Online GmbH, Industriestr. 25,
          91710 Gunzenhausen, Germany.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          2. What Data We Collect
        </h2>

        <h3 className="text-lg font-medium mb-2">
          Account &amp; Authentication Data
        </h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          When you sign in via Twitch OAuth we receive and store your Twitch
          user ID, display name, email address, profile picture URL, and OAuth
          access and refresh tokens (stored encrypted). We request only the
          Twitch scopes required to deliver the service.
        </p>

        <h3 className="text-lg font-medium mb-2">App Content</h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          We store the content you create inside StreamWizard: clip folders,
          overlay configurations, widget settings, and related metadata.
        </p>

        <h3 className="text-lg font-medium mb-2">Analytics Data</h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          We use PostHog (EU region) to collect page-view events and click
          interactions. Your IP address is discarded at ingestion and is never
          stored with analytics events. If you accept analytics cookies and sign
          in, your PostHog analytics profile is linked to your StreamWizard
          account ID so we can understand how the product is used. If you
          decline, we count page views in cookieless mode instead: no cookies,
          no identifiers, no profile. Only anonymous, aggregated statistics
          that cannot be tied to you. We also record a few account-level
          product events on our servers (for example linking your Discord
          account or joining our Discord server), tied to your account under
          legitimate interest. PostHog stores data on EU infrastructure.
        </p>

        <h3 className="text-lg font-medium mb-2">
          Error &amp; Performance Data
        </h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          We use Sentry to capture application errors. Error reports may contain
          your account ID, browser type, operating system, and the URL where the
          error occurred. No passwords or payment data are included in error
          reports.
        </p>

        <h3 className="text-lg font-medium mb-2">Server Logs</h3>
        <p className="text-muted-foreground leading-relaxed">
          Our servers automatically log IP addresses, request timestamps, HTTP
          methods, and response status codes. These logs are used for security
          monitoring and are not shared with third parties.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          3. Why We Process Your Data
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-muted-foreground border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-foreground">
                  Purpose
                </th>
                <th className="text-left py-2 pr-4 font-medium text-foreground">
                  Legal basis (GDPR Art. 6)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 pr-4">
                  Providing the service (auth, app features)
                </td>
                <td className="py-2">
                  Performance of a contract (Art. 6(1)(b))
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4">
                  Product analytics &amp; improvement
                </td>
                <td className="py-2">Legitimate interest (Art. 6(1)(f))</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">
                  Error tracking &amp; service stability
                </td>
                <td className="py-2">Legitimate interest (Art. 6(1)(f))</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Security &amp; fraud prevention</td>
                <td className="py-2">Legitimate interest (Art. 6(1)(f))</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          4. Third-Party Processors
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          We share data with the following sub-processors, all of whom operate
          under GDPR-compliant data processing agreements:
        </p>
        <ul className="space-y-4 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Supabase</span> —
            authentication and database. Data is stored in the EU region.{" "}
            <Link
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              Privacy policy ↗
            </Link>
          </li>
          <li>
            <span className="font-medium text-foreground">PostHog Inc.</span> —
            product analytics. We use PostHog&apos;s EU region
            (eu.i.posthog.com). PostHog may process data outside the EEA
            including in the US; this is covered by a signed Data Processing
            Agreement, Standard Contractual Clauses (EU Commission Decision
            2021/914), and PostHog&apos;s participation in the EU-US Data Privacy
            Framework.{" "}
            <Link
              href="https://posthog.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              Privacy policy ↗
            </Link>
          </li>
          <li>
            <span className="font-medium text-foreground">Sentry</span> — error
            and performance monitoring.{" "}
            <Link
              href="https://sentry.io/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              Privacy policy ↗
            </Link>
          </li>
          <li>
            <span className="font-medium text-foreground">
              Hetzner Online GmbH
            </span>{" "}
            — server hosting in Germany.{" "}
            <Link
              href="https://www.hetzner.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              Privacy policy ↗
            </Link>
          </li>
          <li>
            <span className="font-medium text-foreground">
              Twitch Interactive, Inc.
            </span>{" "}
            — OAuth authentication provider. Your use of Twitch is governed by
            Twitch&apos;s own privacy policy.{" "}
            <Link
              href="https://www.twitch.tv/p/en/legal/privacy-notice/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              Privacy policy ↗
            </Link>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">5. Data Retention</h2>
        <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside">
          <li>
            Account and app data: retained while your account is active. Upon
            account closure, your account and app data are explicitly purged
            from active systems and backups within 3 months.
          </li>
          <li>Analytics data (PostHog): retained for 12 months.</li>
          <li>Error reports (Sentry): retained for 90 days.</li>
          <li>Server logs: retained for 30 days.</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-4">
          You can delete your account at any time from{" "}
          <Link
            href="/dashboard/settings/account"
            className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
          >
            Settings → Account
          </Link>
          , or by emailing{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          6. Your Rights Under GDPR
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          As a data subject under the GDPR you have the following rights:
        </p>
        <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside">
          <li>
            <span className="text-foreground font-medium">Access</span> —
            request a copy of the personal data we hold about you.
          </li>
          <li>
            <span className="text-foreground font-medium">Rectification</span> —
            request correction of inaccurate data.
          </li>
          <li>
            <span className="text-foreground font-medium">Erasure</span> —
            request deletion of your personal data (&quot;right to be forgotten&quot;).
          </li>
          <li>
            <span className="text-foreground font-medium">Restriction</span> —
            request that we limit how we use your data.
          </li>
          <li>
            <span className="text-foreground font-medium">Portability</span> —
            receive your data in a structured, machine-readable format.
          </li>
          <li>
            <span className="text-foreground font-medium">Objection</span> —
            object to processing based on legitimate interest.
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-4">
          To exercise any of these rights, email{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
          >
            {CONTACT_EMAIL}
          </a>
          . We will respond within 30 days. You also have the right to lodge a
          complaint with a supervisory authority — in the Netherlands, the{" "}
          <Link
            href="https://www.autoriteitpersoonsgegevens.nl"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
          >
            Autoriteit Persoonsgegevens ↗
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          7. Cookies &amp; Browser Storage
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          We use the following browser storage:
        </p>
        <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside">
          <li>
            <span className="text-foreground font-medium">
              Authentication cookies
            </span>{" "}
            (Supabase) — strictly necessary to keep you signed in. These cannot
            be disabled without breaking the service.
          </li>
          <li>
            <span className="text-foreground font-medium">
              Analytics cookies
            </span>{" "}
            (PostHog) — only set if you accept analytics; used to recognise your
            browser across sessions. Stored under our own domain via a reverse
            proxy to prevent ad-blocker interference. If you decline, no
            analytics cookies or identifiers are stored at all.
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-4">
          We do not use advertising, remarketing, or third-party tracking
          cookies. Changed your mind about analytics? Cookie settings in the
          footer clears your choice and asks again.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          8. International Data Transfers
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Most personal data is processed within the EU/EEA (Supabase EU region,
          Hetzner Germany, PostHog EU region). However, some data may be
          transferred outside the EEA:
        </p>
        <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside mb-4">
          <li>
            <span className="text-foreground font-medium">
              PostHog Inc. (US)
            </span>{" "}
            — covered by a signed Data Processing Agreement, EU Standard
            Contractual Clauses (Module 2, Commission Decision 2021/914), and
            PostHog&apos;s self-certification under the EU-US Data Privacy Framework.
          </li>
          <li>
            <span className="text-foreground font-medium">
              Twitch Interactive, Inc. (US)
            </span>{" "}
            — data shared as part of OAuth authentication is governed by
            Twitch&apos;s own Privacy Policy and their EU data transfer mechanisms.
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed">
          We do not transfer personal data to any other countries outside the
          EEA without adequate safeguards in place.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          9. Changes to This Policy
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          We may update this Privacy Policy from time to time. When we do, we
          will update the &quot;Last updated&quot; date at the top of this page. We
          encourage you to review this page periodically. Continued use of the
          service after changes constitutes acceptance of the updated policy.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">10. Contact</h2>
        <p className="text-muted-foreground leading-relaxed">
          For any privacy-related questions or to exercise your GDPR rights,
          contact us at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <LegalNotice variant="normal" />

      <div className="mt-16 pt-8 border-t border-border">
        <Link
          href="/terms-of-service"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
          Read our Terms of Service →
        </Link>
      </div>
    </>
  );
}

function GenZContent() {
  return (
    <>
      <h1 className="text-4xl font-bold mb-2">Privacy Policy 🔒</h1>
      <p className="text-sm text-muted-foreground mb-12">
        last updated: {LAST_UPDATED} (yes we actually update it fr)
      </p>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          1. who even are we 👀
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          StreamWizard is a Twitch tool for streamers. run by J. van der Wit,
          servers living their best life in Germany (Hetzner). hit us up at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          if u got beef (or just questions, that&apos;s fine too).
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          2. what data we&apos;re holding 💾
        </h2>

        <h3 className="text-lg font-medium mb-2">ur account stuff</h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          when u log in via Twitch we get ur Twitch ID, display name, email, pfp
          URL, and OAuth tokens (encrypted, we&apos;re not animals). we only ask for
          the scopes we actually need. no weird scope grabs.
        </p>

        <h3 className="text-lg font-medium mb-2">the stuff u make</h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          clip folders, overlays, widget configs — all that. it&apos;s yours. we just
          hold it for you.
        </p>

        <h3 className="text-lg font-medium mb-2">
          analytics (if u said yes to cookies)
        </h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          we use PostHog to see what pages people visit + where they click. ur
          IP gets dropped at the door, never stored with analytics. once ur
          logged in we link ur PostHog profile to ur account ID so we can
          understand what&apos;s cooked vs what slaps. EU region only. said no to
          cookies? then it&apos;s cookieless mode: no cookies, no profile, ur just
          an anonymous +1 in the page stats. nothing traces back to u. our
          servers also log a few account moments (like linking Discord or
          joining our Discord server) so we know the community is growing.
        </p>

        <h3 className="text-lg font-medium mb-2">when things go wrong 💀</h3>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Sentry catches app errors. it might grab ur account ID, browser type,
          OS, and the URL that caused the chaos. no passwords, no payment info.
          just vibes and stack traces.
        </p>

        <h3 className="text-lg font-medium mb-2">server logs</h3>
        <p className="text-muted-foreground leading-relaxed">
          our servers log IP addresses, request timestamps, HTTP methods, and
          status codes. purely for security. not shared. not sold. not vibed
          with by randos.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          3. why we even process ur data 🤔
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-muted-foreground border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-foreground">
                  what we&apos;re doing
                </th>
                <th className="text-left py-2 pr-4 font-medium text-foreground">
                  legal reason (GDPR Art. 6)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 pr-4">
                  running the actual service (auth, features)
                </td>
                <td className="py-2">contract performance (Art. 6(1)(b))</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">
                  analytics so we stop shipping L updates
                </td>
                <td className="py-2">legitimate interest (Art. 6(1)(f))</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">
                  catching errors before they go viral
                </td>
                <td className="py-2">legitimate interest (Art. 6(1)(f))</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">keeping the bad guys out</td>
                <td className="py-2">legitimate interest (Art. 6(1)(f))</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          4. companies we fw (the trusted ones) 🤝
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          we share data with these guys. all GDPR-compliant, all have proper
          data processing agreements. no randos. no sketchy stuff.
        </p>
        <ul className="space-y-4 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Supabase</span> — auth
            + database, chilling in the EU.{" "}
            <Link
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              their privacy policy ↗
            </Link>
          </li>
          <li>
            <span className="font-medium text-foreground">PostHog Inc.</span> —
            analytics. EU region (eu.i.posthog.com). they can
            process data in the US but it&apos;s covered by a signed DPA, Standard
            Contractual Clauses, and the EU-US Data Privacy Framework. we did
            the paperwork fr.{" "}
            <Link
              href="https://posthog.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              their privacy policy ↗
            </Link>
          </li>
          <li>
            <span className="font-medium text-foreground">Sentry</span> —
            catches errors so we know when things go boom.{" "}
            <Link
              href="https://sentry.io/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              their privacy policy ↗
            </Link>
          </li>
          <li>
            <span className="font-medium text-foreground">
              Hetzner Online GmbH
            </span>{" "}
            — our German server landlords.{" "}
            <Link
              href="https://www.hetzner.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              their privacy policy ↗
            </Link>
          </li>
          <li>
            <span className="font-medium text-foreground">
              Twitch Interactive, Inc.
            </span>{" "}
            — OAuth login provider. ur Twitch usage is covered by Twitch&apos;s own
            policy, not ours.{" "}
            <Link
              href="https://www.twitch.tv/p/en/legal/privacy-notice/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              their privacy policy ↗
            </Link>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          5. how long we keep ur stuff ⏳
        </h2>
        <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside">
          <li>
            account + app data: kept while ur account&apos;s alive. when u close
            it, we purge it from active systems AND backups within 3 months.
            actually gone, not vibes.
          </li>
          <li>analytics (PostHog): 12 months.</li>
          <li>error reports (Sentry): 90 days.</li>
          <li>server logs: 30 days.</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-4">
          want out? hit{" "}
          <Link
            href="/dashboard/settings/account"
            className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
          >
            Settings → Account
          </Link>{" "}
          and delete ur account, or email{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
          >
            {CONTACT_EMAIL}
          </a>
          . we&apos;ll sort it. no cap.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          6. ur rights (they&apos;re real, use them) ✊
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          GDPR gives u actual rights and we have to honour them. here&apos;s the
          list:
        </p>
        <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside">
          <li>
            <span className="text-foreground font-medium">Access</span> — ask us
            what data we have on u.
          </li>
          <li>
            <span className="text-foreground font-medium">Rectification</span> —
            something wrong? we fix it.
          </li>
          <li>
            <span className="text-foreground font-medium">Erasure</span> — the
            right to be forgotten. it&apos;s a thing. use it.
          </li>
          <li>
            <span className="text-foreground font-medium">Restriction</span> —
            tell us to chill on how we use ur data.
          </li>
          <li>
            <span className="text-foreground font-medium">Portability</span> —
            get ur data in a format u can actually use.
          </li>
          <li>
            <span className="text-foreground font-medium">Objection</span> —
            disagree with how we&apos;re processing ur data? say so.
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-4">
          email{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          to use any of these. we respond within 30 days. if we&apos;re being
          cooked about it u can also complain to the{" "}
          <Link
            href="https://www.autoriteitpersoonsgegevens.nl"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
          >
            Autoriteit Persoonsgegevens ↗
          </Link>{" "}
          (Dutch data watchdog, they&apos;re based).
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          7. cookies &amp; browser storage 🍪
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          here&apos;s what&apos;s living in ur browser:
        </p>
        <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside">
          <li>
            <span className="text-foreground font-medium">auth cookies</span>{" "}
            (Supabase) — keeps u logged in. strictly necessary. turning these
            off breaks everything and that&apos;s on u.
          </li>
          <li>
            <span className="text-foreground font-medium">
              analytics cookies
            </span>{" "}
            (PostHog) — only set if u accepted. recognises ur browser across
            sessions. runs through our own domain so ad blockers don&apos;t clap
            it. declined? zero analytics cookies, zero identifiers. fr.
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-4">
          zero advertising cookies. zero remarketing. zero selling ur attention
          to randos. that&apos;s loser behavior ngl. wanna un-consent? cookie
          settings in the footer, one click, we ask again.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          8. data leaving the EU 🌍
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          mostly ur data stays in the EU. but two companies process stuff in the
          US:
        </p>
        <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside mb-4">
          <li>
            <span className="text-foreground font-medium">PostHog (US)</span> —
            covered by signed DPA + EU Standard Contractual Clauses (Module 2,
            Decision 2021/914) + EU-US Data Privacy Framework. we did the legal
            homework.
          </li>
          <li>
            <span className="text-foreground font-medium">Twitch (US)</span> —
            their OAuth, their rules. covered by Twitch&apos;s own EU transfer
            mechanisms.
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed">
          nobody else gets ur data outside the EEA. fr.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          9. if this policy changes 📝
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          we&apos;ll update the date at the top. check back sometimes.
          continuing to use StreamWizard after changes means u accept the new
          version. we&apos;ll try to flag big changes tho, we&apos;re not sneaky
          about it.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">
          10. questions? concerns? just vibing? 💬
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          slide into our inbox at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
          >
            {CONTACT_EMAIL}
          </a>
          . we actually read these.
        </p>
      </section>

      <LegalNotice variant="genz" />

      <div className="mt-16 pt-8 border-t border-border">
        <Link
          href="/terms-of-service"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
          Read our Terms of Service →
        </Link>
      </div>
    </>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <LegalTabs normal={<NormalContent />} genz={<GenZContent />} />
      </div>
    </div>
  );
}
