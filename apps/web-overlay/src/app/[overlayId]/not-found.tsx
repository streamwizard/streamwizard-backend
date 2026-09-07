import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Overlay not found — StreamWizard Overlay",
  robots: { index: false, follow: false },
};

/**
 * Shown when `notFound()` is called from `/overlay/[overlayId]` (missing slug/id or inactive slug).
 */
export default function OverlayNotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
        background: "#0a0a0a",
        color: "#e5e5e5",
        fontFamily:
          "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
        textAlign: "center",
      }}
    >
      <img
        src="/logo.png"
        alt=""
        width={40}
        height={40}
        style={{ opacity: 0.6, marginBottom: 20 }}
      />
      <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.08em", opacity: 0.5 }}>
        404
      </p>
      <h1 style={{ margin: "12px 0 0", fontSize: 22, fontWeight: 600 }}>
        This scene doesn&rsquo;t exist
      </h1>
      <p
        style={{
          margin: "16px 0 0",
          maxWidth: 440,
          fontSize: 15,
          lineHeight: 1.5,
          opacity: 0.75,
        }}
      >
        Wrong id, wrong slug, or the scene got turned off. Copy the overlay
        URL again from your StreamWizard dashboard and try that one instead.
      </p>
    </div>
  );
}
