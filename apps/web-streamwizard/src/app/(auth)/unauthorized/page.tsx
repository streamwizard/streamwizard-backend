import type { Metadata } from "next";
import NotWhitelisted from "@/components/cards/not-whitelisted";

// A dead end for accounts that are not on the list: nothing here belongs in a
// search result. noindex rather than a robots.txt Disallow, so crawlers can
// actually read it.
export const metadata: Metadata = {
  title: "Not on the list",
  robots: { index: false, follow: false },
};

export default function page() {
  return <NotWhitelisted />;
}
