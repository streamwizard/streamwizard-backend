import { LegalNotice } from "@/components/legal/legal-notice";
import { LegalTabs } from "@/components/legal-tabs";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal";
import { absoluteUrl } from "@/lib/seo";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  // Suffix comes from the root layout's title template.
  title: "Terms of Service",
  description: "The terms and conditions governing your use of StreamWizard.",
  alternates: { canonical: absoluteUrl("/terms-of-service") },
};

const LAST_UPDATED = "26 May 2026";
const CONTACT_EMAIL = LEGAL_CONTACT_EMAIL;

function NormalContent() {
  return (
    <>
      <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-12">Last updated: {LAST_UPDATED}</p>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">1. Acceptance of Terms</h2>
        <p className="text-muted-foreground leading-relaxed">
          By accessing or using StreamWizard (&quot;the Service&quot;), you agree to be bound by these Terms of
          Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the Service. These Terms
          form a legally binding agreement between you and J. van der Wit (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;),
          the operator of StreamWizard.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">2. Service Description</h2>
        <p className="text-muted-foreground leading-relaxed">
          StreamWizard is a Twitch stream management platform that provides tools for organising
          clips, creating and managing stream overlays, configuring widgets, and other stream
          enhancement utilities. The Service integrates with the Twitch
          platform via its official API and OAuth authentication.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">3. Relationship with Twitch</h2>
        <p className="text-muted-foreground leading-relaxed">
          StreamWizard is an independent third-party application developed and operated by J. van der Wit.
          We are not owned, operated, officially endorsed, or sponsored by Twitch Interactive, Inc.,
          Amazon.com, Inc., or any of their affiliates. Use of the Twitch name, logo, or platform
          features does not imply any affiliation with or approval by Twitch or Amazon. Your relationship
          with Twitch is governed solely by Twitch&apos;s own terms and policies.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">4. Eligibility</h2>
        <p className="text-muted-foreground leading-relaxed">
          To use the Service you must:
        </p>
        <ul className="mt-3 space-y-2 text-muted-foreground leading-relaxed list-disc list-inside">
          <li>Hold a valid Twitch account in good standing.</li>
          <li>Comply with{" "}
            <Link href="https://www.twitch.tv/p/en/legal/terms-of-service/" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors">
              Twitch&apos;s Terms of Service ↗
            </Link>
            {" "}and Community Guidelines at all times.
          </li>
          <li>Be at least 13 years of age, or the minimum age required in your country of residence.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">5. Account &amp; Security</h2>
        <p className="text-muted-foreground leading-relaxed">
          Access to StreamWizard is granted exclusively via Twitch OAuth — we do not manage separate
          passwords. You are responsible for maintaining the security of your Twitch account and for
          all activity that occurs through your StreamWizard account. Notify us immediately at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors">
            {CONTACT_EMAIL}
          </a>
          {" "}if you suspect unauthorised access.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">6. Acceptable Use</h2>
        <p className="text-muted-foreground leading-relaxed mb-3">You agree not to:</p>
        <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside">
          <li>Use the Service for any unlawful purpose or in violation of any applicable law or regulation.</li>
          <li>Attempt to gain unauthorised access to any part of the Service or its infrastructure.</li>
          <li>Reverse engineer, decompile, or disassemble any part of the Service.</li>
          <li>Use the Service in a manner that violates Twitch&apos;s Terms of Service, Developer Agreement, or API usage policies.</li>
          <li>Transmit malicious code, spam, or disruptive content through the Service.</li>
          <li>Scrape, harvest, or otherwise collect data from the Service without our express written consent.</li>
          <li>Use the Service to harass, abuse, or harm other users or third parties.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">7. Your Content</h2>
        <p className="text-muted-foreground leading-relaxed">
          You retain ownership of any content you create or upload through StreamWizard (overlays,
          widget configurations, folder structures, etc.). By using the Service, you grant us a
          limited, non-exclusive, worldwide, royalty-free licence to store, process, and display your
          content solely to the extent necessary to operate and deliver the Service to you. We do not
          sell or share your content with third parties except as required to operate the Service (see
          our{" "}
          <Link href="/privacy-policy" className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors">
            Privacy Policy
          </Link>
          ).
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">8. Termination</h2>
        <p className="text-muted-foreground leading-relaxed">
          You may delete your account at any time from{" "}
          <Link href="/dashboard/settings/account" className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors">
            Settings → Account
          </Link>
          {" "}or by contacting{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors">
            {CONTACT_EMAIL}
          </a>
          . We reserve the right to suspend or terminate your access to the Service, with or without
          notice, if we reasonably believe you have violated these Terms, Twitch&apos;s policies, or
          applicable law. Upon termination, your right to use the Service ceases immediately. We will
          delete your personal data in accordance with our Privacy Policy.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">9. Free Service; Disclaimer of Warranties</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          StreamWizard is provided to you free of charge. You acknowledge that you receive the Service
          without payment and that no fee-based service level, uptime guarantee, or support obligation
          applies unless we expressly agree otherwise in writing.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          The Service is provided <span className="italic">&quot;as is&quot;</span> and{" "}
          <span className="italic">&quot;as available&quot;</span> without warranties of any kind, whether express,
          implied, or statutory, including but not limited to warranties of merchantability, fitness for
          a particular purpose, non-infringement, accuracy, reliability, or uninterrupted availability.
          We do not warrant that the Service will be error-free, secure, compatible with your broadcast
          setup, or that any defects will be corrected. You use the Service at your own risk. We may
          modify, suspend, or discontinue the Service at any time without notice.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">10. Limitation of Liability</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          To the maximum extent permitted by applicable EU law, we shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages arising out of or related
          to your use of or inability to use the Service, even if we have been advised of the
          possibility of such damages. Without limiting the foregoing, we expressly disclaim liability
          for any loss or damage arising from:
        </p>
        <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside mb-4">
          <li>interrupted, failed, or degraded live streams or broadcasts;</li>
          <li>bugs, outages, or malfunctions occurring during or in connection with a broadcast;</li>
          <li>lost or reduced advertising revenue, sponsorship income, donations, or other monetisation;</li>
          <li>lost or reduced subscription, follower, or channel revenue on Twitch or any other platform;</li>
          <li>damage to your reputation, content, equipment, or third-party integrations caused by Service issues.</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed">
          Where liability cannot be fully excluded under Dutch or EU law, our total aggregate liability
          to you for any claim arising out of or relating to the Service shall not exceed €0 (zero euros),
          reflecting the free nature of the Service. Nothing in these Terms limits our liability for death
          or personal injury caused by negligence, fraud, or any liability that cannot be excluded under
          Dutch or EU law.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">11. Governing Law &amp; Disputes</h2>
        <p className="text-muted-foreground leading-relaxed">
          These Terms are governed by the laws of the Netherlands, without regard to its conflict of
          law provisions. Any disputes arising under these Terms that cannot be resolved amicably
          shall be submitted to the competent courts of the Netherlands. If you are a consumer in the
          EU, you may also use the{" "}
          <Link href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors">
            EU Online Dispute Resolution platform ↗
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">12. Changes to These Terms</h2>
        <p className="text-muted-foreground leading-relaxed">
          We may update these Terms at any time. We will update the &quot;Last updated&quot; date at the top
          of this page when we do. Continued use of the Service after changes take effect constitutes
          your acceptance of the revised Terms. If we make material changes we will make reasonable
          efforts to notify active users.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">13. Contact</h2>
        <p className="text-muted-foreground leading-relaxed">
          Questions about these Terms? Reach us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <LegalNotice variant="normal" />

      <div className="mt-16 pt-8 border-t border-border">
        <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
          Read our Privacy Policy →
        </Link>
      </div>
    </>
  );
}

function GenZContent() {
  return (
    <>
      <h1 className="text-4xl font-bold mb-2">Terms of Service 📜</h1>
      <p className="text-sm text-muted-foreground mb-12">last updated: {LAST_UPDATED} (pls actually read this one fr)</p>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">1. u gotta agree to this 🤝</h2>
        <p className="text-muted-foreground leading-relaxed">
          by using StreamWizard u agree to these terms. if u don&apos;t agree, don&apos;t use the service.
          that&apos;s it. this is a legally binding thing between u and J. van der Wit (that&apos;s us).
          it&apos;s not optional vibes, it&apos;s actual law stuff.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">2. what StreamWizard actually is 🎮</h2>
        <p className="text-muted-foreground leading-relaxed">
          it&apos;s a Twitch stream management tool. u can organise clips, build overlays, configure widgets,
          and do other streamer stuff. we connect to Twitch via their official API and OAuth.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">3. we&apos;re not Twitch (or Amazon) 🚫</h2>
        <p className="text-muted-foreground leading-relaxed">
          StreamWizard is our thing — built and run by J. van der Wit. we are NOT owned by, operated by,
          officially endorsed by, or sponsored by Twitch, Amazon, or any of their companies. seeing Twitch
          logos or using Twitch login doesn&apos;t mean they vouch for us. ur deal with Twitch is between u
          and Twitch; read their terms separately.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">4. who can use this 👶</h2>
        <p className="text-muted-foreground leading-relaxed">
          to use StreamWizard u need to:
        </p>
        <ul className="mt-3 space-y-2 text-muted-foreground leading-relaxed list-disc list-inside">
          <li>have a valid Twitch account that&apos;s not banned or cooked.</li>
          <li>follow{" "}
            <Link href="https://www.twitch.tv/p/en/legal/terms-of-service/" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors">
              Twitch&apos;s Terms of Service ↗
            </Link>
            {" "}and their Community Guidelines. if twitch bans u, that&apos;s a you problem.
          </li>
          <li>be at least 13 (or whatever ur country requires). no cap.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">5. ur account security 🔐</h2>
        <p className="text-muted-foreground leading-relaxed">
          we log u in through Twitch OAuth — no separate passwords, we&apos;re not that company.
          ur Twitch account security is ur responsibility. if something sketchy happens, email us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors">
            {CONTACT_EMAIL}
          </a>
          {" "}immediately. don&apos;t wait, don&apos;t post about it on Twitter first.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">6. don&apos;t be cooked 💀</h2>
        <p className="text-muted-foreground leading-relaxed mb-3">seriously, don&apos;t:</p>
        <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside">
          <li>use StreamWizard for illegal stuff. obviously.</li>
          <li>try to hack us or get into parts of the service u shouldn&apos;t be in.</li>
          <li>reverse engineer the app. that&apos;s not it.</li>
          <li>violate Twitch&apos;s ToS or Developer Agreement while using our stuff.</li>
          <li>spam, send malware, or do anything disruptive through the service.</li>
          <li>scrape our data without permission. we will notice.</li>
          <li>use the service to be mean to people. come on.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">7. ur content is urs 🎨</h2>
        <p className="text-muted-foreground leading-relaxed">
          ur overlays, widget configs, clip folders — u own all that. we just store and process it
          to run the service. we do NOT sell ur content. we do NOT share it with randos. we only
          use it to give u StreamWizard. see our{" "}
          <Link href="/privacy-policy" className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors">
            Privacy Policy
          </Link>
          {" "}for the full breakdown.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">8. getting banned (or leaving) 🚪</h2>
        <p className="text-muted-foreground leading-relaxed">
          u can delete ur account anytime in{" "}
          <Link href="/dashboard/settings/account" className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors">
            Settings → Account
          </Link>
          {" "}or email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors">
            {CONTACT_EMAIL}
          </a>
          . we can also ban u if u violate these terms, Twitch&apos;s rules, or the law. no warning required
          if it&apos;s serious. once ur out, ur access is gone immediately. ur data gets deleted per our Privacy Policy.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">9. it&apos;s free — use at ur own risk 🆓</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          StreamWizard costs u nothing. zero euros. no paid tier, no SLA, no &quot;we owe u 99.9% uptime&quot;
          unless we literally sign something saying otherwise. u get what u get.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          the service is as-is, as-available. no warranties — express, implied, or otherwise. we don&apos;t
          promise it&apos;ll be bug-free, secure, or play nice with ur OBS setup. bugs happen. downtime happens.
          use at ur own risk. we can change, pause, or kill features whenever. chaotic? yes. legal? also yes.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">10. if things break, don&apos;t sue us ⚖️</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          to the max EU law allows, we&apos;re not on the hook for indirect, incidental, or consequential
          damage from using (or not using) StreamWizard. specifically — and read this part — we&apos;re NOT
          liable if:
        </p>
        <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc list-inside mb-4">
          <li>ur stream dies, glitches, or goes offline mid-broadcast;</li>
          <li>a bug hits during a live and ruins the vibe (or the VOD);</li>
          <li>u lose ad money, sponsor cash, donations, or any other bag;</li>
          <li>u lose subs, followers, or channel revenue on Twitch or anywhere else;</li>
          <li>ur rep, content, gear, or integrations get cooked because our app had a moment.</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed">
          where the law won&apos;t let us dodge everything, our total liability cap is €0 — because u paid
          nothing. we&apos;re still on the hook for the stuff Dutch/EU law says we can&apos;t exclude (death,
          personal injury from negligence, fraud, that kind of serious business).
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">11. we&apos;re Dutch, disputes go to Dutch courts 🇳🇱</h2>
        <p className="text-muted-foreground leading-relaxed">
          these terms are governed by Dutch law. if there&apos;s a beef that can&apos;t be resolved nicely,
          it goes to a Dutch court. if you&apos;re an EU consumer u can also use the{" "}
          <Link href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors">
            EU Online Dispute Resolution platform ↗
          </Link>
          . we&apos;d rather just talk it out tho ngl.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">12. if these terms change 📝</h2>
        <p className="text-muted-foreground leading-relaxed">
          we&apos;ll update the date at the top. continuing to use StreamWizard after changes = u accept them.
          if it&apos;s something big we&apos;ll try to actually tell u about it. we&apos;re not trying to sneak anything in.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">13. questions? 💬</h2>
        <p className="text-muted-foreground leading-relaxed">
          slide into our inbox at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors">
            {CONTACT_EMAIL}
          </a>
          . we&apos;re people, not a legal robot.
        </p>
      </section>

      <LegalNotice variant="genz" />

      <div className="mt-16 pt-8 border-t border-border">
        <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
          Read our Privacy Policy →
        </Link>
      </div>
    </>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <LegalTabs normal={<NormalContent />} genz={<GenZContent />} />
      </div>
    </div>
  );
}
