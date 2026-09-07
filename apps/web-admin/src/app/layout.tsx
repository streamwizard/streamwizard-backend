import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "StreamWizard Admin",
  description: "Internal admin control panel",
  // Internal tool: keep every route out of search results.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
          <Toaster position="bottom-right" theme="dark" expand visibleToasts={5} />
        </ThemeProvider>
      </body>
    </html>
  );
}
