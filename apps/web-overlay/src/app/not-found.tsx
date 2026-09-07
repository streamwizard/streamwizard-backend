import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Not found — StreamWizard Overlay",
  robots: { index: false, follow: false },
};

export default function NotFound() {
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
        No overlay here
      </h1>
      <p
        style={{
          margin: "16px 0 0",
          maxWidth: 420,
          fontSize: 15,
          lineHeight: 1.5,
          opacity: 0.75,
        }}
      >
        This link doesn&rsquo;t point at a real overlay. Grab the correct URL
        from your StreamWizard dashboard and drop it back into OBS.
      </p>
    </div>
  );
}
