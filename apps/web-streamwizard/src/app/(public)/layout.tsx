import { Footer } from "@/components/public/layout/footer";
import Header from "@/components/public/layout/header";
import { ScrollToTop } from "@/components/buttons/scroll-to-top";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationSchema } from "@/lib/seo";
import { hasSessionCookie } from "@/lib/auth";

// No metadata export here on purpose. This layout used to duplicate the root's
// title/description with different wording, so the two disagreed about what the
// product is. Public pages now inherit the root metadata and override per page.

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Cookie presence only, never a Supabase call: this decides a button label,
  // not access. See hasSessionCookie in src/lib/auth.ts.
  const isAuthenticated = await hasSessionCookie();

  return (
    <>
      <JsonLd schema={organizationSchema()} />
      <Header isAuthenticated={isAuthenticated} />
      <main>{children}</main>
      <Footer />
      <ScrollToTop />
    </>
  );
}
