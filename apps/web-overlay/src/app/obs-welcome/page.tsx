import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OBS Cloud",
  description:
    "Welcome screen for StreamWizard cloud OBS instances. Shown as a browser source in OBS.",
  robots: { index: false, follow: false },
};

const LOGO_URL = "https://cdn.streamwizard.org/public/img/streamwizard.png";

/**
 * Static welcome screen for cloud OBS browser sources.
 * Nothing is clickable — OBS browser sources don't handle pointer input reliably.
 */
export default function ObsWelcomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 32px",
        boxSizing: "border-box",
        background: "#0a0a0a",
        color: "#e5e5e5",
        fontFamily:
          "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
        textAlign: "center",
      }}
    >
      <img
        src={LOGO_URL}
        alt="StreamWizard"
        width={72}
        height={72}
        style={{ display: "block", opacity: 0.95 }}
      />

      <h1
        style={{
          margin: "28px 0 0",
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        Welcome to your OBS cloud instance
      </h1>

      <p
        style={{
          margin: "16px 0 0",
          maxWidth: 520,
          fontSize: 16,
          lineHeight: 1.6,
          opacity: 0.8,
        }}
      >
        This is StreamWizard Cloud OBS. Your rig lives in the cloud so you can
        stream IRL without lugging a tower around.
      </p>

      <div
        style={{
          margin: "32px 0 0",
          maxWidth: 520,
          padding: "20px 24px",
          borderRadius: 12,
          border: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(255, 255, 255, 0.03)",
          textAlign: "left",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            opacity: 0.5,
          }}
        >
          Why some OBS stuff is missing
        </p>
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 15,
            lineHeight: 1.6,
            opacity: 0.85,
          }}
        >
          We removed features that do not belong on an IRL cloud rig, or that
          are a security risk on a shared box. Studio Mode, plugin installs,
          arbitrary file paths. That kind of thing.
        </p>
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 15,
            lineHeight: 1.6,
            opacity: 0.85,
          }}
        >
          What you have left is what you actually need to go live from your
          phone or backpack setup.
        </p>
      </div>

      <p
        style={{
          margin: "32px 0 0",
          maxWidth: 480,
          fontSize: 15,
          lineHeight: 1.6,
          opacity: 0.65,
        }}
      >
        Need the full list? Read{" "}
        <span style={{ color: "#e5e5e5", opacity: 1 }}>docs.streamwizard.org</span>
        .
      </p>

      <p
        style={{
          margin: "12px 0 0",
          maxWidth: 480,
          fontSize: 15,
          lineHeight: 1.6,
          opacity: 0.65,
        }}
      >
        Clicking or copying from a browser source? Denied. Luckily, we put a
        Discord Community button in the sidebar for when you just can&apos;t be
        bothered. Honestly? Respect.
      </p>
    </div>
  );
}
