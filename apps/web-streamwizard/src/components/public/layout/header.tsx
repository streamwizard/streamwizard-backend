"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  cn,
} from "@repo/ui";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, Menu } from "lucide-react";
import { BsTwitch } from "react-icons/bs";
import { FaDiscord, FaGithub } from "react-icons/fa";
import type { IconType } from "react-icons";
import TwitchLogin from "@/components/buttons/twitch-login";
import { docsLink, socialLinks } from "@/lib/constant";
import { TrackedLink } from "../analytics/tracked-link";
import { companyNavItems, legalNavItems, productNavItems, type NavItem } from "./header-nav-items";

/*
 * The public header.
 *
 * Transparent while the page is at the top so it sits on the hero, then fades
 * to a blurred bar once you scroll. Every link routes through TrackedLink, and
 * the section names below are load-bearing: the staging "Landing page"
 * dashboard groups on them, so rename them there before renaming them here.
 */

const SCROLL_THRESHOLD = 24;

const navSections = [
  { value: "product", label: "Product", items: productNavItems },
  { value: "company", label: "Company", items: companyNavItems },
];

/*
 * Brand marks have no lucide equivalent, so the socials keep react-icons.
 * Keyed by the name in `socialLinks`; anything unmapped renders without a mark
 * rather than crashing the header.
 */
const socialIcons: Record<string, IconType> = {
  Discord: FaDiscord,
  GitHub: FaGithub,
  Twitch: BsTwitch,
};


/*
 * The Product dropdown. Radix anchors the panel to the trigger's left edge,
 * which is what we want now that the trigger is the leftmost item in the bar:
 * a 32rem panel opening rightwards clears the viewport at every width the bar
 * is visible at. Right-aligning it instead pushed it 125px off the left edge
 * at 1024.
 */
function NavDropdown({
  label,
  items,
  columns,
  isCurrent,
}: {
  label: string;
  items: NavItem[];
  columns: 1 | 2;
  isCurrent: (href: string) => boolean;
}) {
  const active = items.some((item) => isCurrent(item.href));

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        className={cn(
          "bg-transparent text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground data-[state=open]:bg-accent/50 data-[state=open]:text-foreground",
          active && "text-foreground"
        )}
      >
        {label}
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul
          className={cn(
            "grid gap-1 p-2",
            columns === 2 ? "w-[32rem] grid-cols-2" : "w-[20rem] grid-cols-1"
          )}
        >
          {items.map((item, index) => (
            <li
              key={item.href}
              className={cn(
                // Odd count in a 2-column grid: the last one takes the empty
                // cell beside it rather than leaving a hole.
                columns === 2 &&
                  index === items.length - 1 &&
                  items.length % 2 === 1 &&
                  "col-span-2"
              )}
            >
              <NavigationMenuLink asChild>
                <TrackedLink
                  href={item.href}
                  cta={item.cta}
                  section="header_product_menu"
                  aria-current={isCurrent(item.href) ? "page" : undefined}
                  className={cn(
                    "flex flex-row items-start gap-3 rounded-md p-3 transition-colors hover:bg-accent/60",
                    isCurrent(item.href) && "bg-accent/40"
                  )}
                >
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-purple-300" aria-hidden="true" />
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-medium leading-none text-foreground">{item.name}</span>
                    <span className="text-xs leading-snug text-muted-foreground">{item.description}</span>
                  </span>
                </TrackedLink>
              </NavigationMenuLink>
            </li>
          ))}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}

export default function Header({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Read once on mount too: a refresh partway down the page would otherwise
    // paint a transparent header over content until the first scroll event.
    const sync = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  // Radix leaves the sheet open across a client-side navigation, so it would
  // otherwise stay parked over whatever page the link went to.
  const closeMenu = () => setMenuOpen(false);

  const isCurrent = (href: string) => pathname === href;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-200",
        scrolled && "border-b border-white/[0.08] bg-background/80 backdrop-blur-xl"
      )}
    >
      <div className="container mx-auto px-4">
        {/* Fixed height, so the transparent/solid swap can't shift the page. */}
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-xl font-bold sm:text-2xl">
            <Image alt="StreamWizard" src="/logo.png" width={40} height={40} style={{ width: 40, height: 40 }} />
            <span>StreamWizard</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 lg:flex">
            <NavigationMenu viewport={false}>
              <NavigationMenuList>
                <NavDropdown label="Product" items={productNavItems} columns={2} isCurrent={isCurrent} />
              </NavigationMenuList>
            </NavigationMenu>

            {companyNavItems.map((item) => (
              <TrackedLink
                key={item.href}
                href={item.href}
                cta={item.cta}
                section="header"
                aria-current={isCurrent(item.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  isCurrent(item.href) && "text-foreground"
                )}
              >
                {item.name}
              </TrackedLink>
            ))}

            <TrackedLink
              href={docsLink}
              cta="docs"
              section="header"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Docs
            </TrackedLink>

            {/* Plain rule: Separator's data-[orientation=vertical]:h-full outranks any
                height set here, so it would stretch to the full 4rem row. */}
            <div aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />

            <div className="flex items-center gap-0.5">
              {socialLinks.map((social) => {
                const Icon = socialIcons[social.name];
                return (
                  <Button key={social.href} asChild variant="ghost" size="icon-sm">
                    <TrackedLink
                      href={social.href}
                      cta={social.cta}
                      section="header"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                      <span className="sr-only">{social.name}</span>
                    </TrackedLink>
                  </Button>
                );
              })}
            </div>

            <div className="ml-1">
              {isAuthenticated ? (
                <Button asChild>
                  <TrackedLink href="/dashboard" cta="dashboard" section="header">
                    Dashboard
                  </TrackedLink>
                </Button>
              ) : (
                <TwitchLogin redirect="/dashboard" text="Log in" source="header" />
              )}
            </div>
          </div>

          {/* Mobile nav. The CTA stays outside the sheet so signing in is one tap. */}
          <div className="flex items-center gap-2 lg:hidden">
            {isAuthenticated ? (
              <Button asChild size="sm">
                <TrackedLink href="/dashboard" cta="dashboard" section="header_mobile">
                  Dashboard
                </TrackedLink>
              </Button>
            ) : (
              <TwitchLogin redirect="/dashboard" text="Log in" size="sm" source="header_mobile" />
            )}

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="flex w-[19rem] flex-col gap-0 p-0 sm:w-[22rem]">
                <SheetHeader className="border-b border-white/[0.08] p-4 pr-12">
                  <SheetTitle className="flex items-center gap-2 text-left text-base font-bold">
                    <Image
                      alt="StreamWizard"
                      src="/logo.png"
                      width={28}
                      height={28}
                      style={{ width: 28, height: 28 }}
                    />
                    StreamWizard
                  </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-4">
                  {/* Both sections open by default: the sheet is the only nav on mobile,
                      so hiding half of it behind a tap would be worse than scrolling. */}
                  <Accordion type="multiple" defaultValue={["product", "company"]}>
                    {navSections.map((section) => (
                      <AccordionItem key={section.value} value={section.value} className="border-none">
                        <AccordionTrigger className="py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground hover:no-underline">
                          {section.label}
                        </AccordionTrigger>
                        <AccordionContent className="pb-2">
                          <nav className="flex flex-col">
                            {section.items.map((item) => (
                              <TrackedLink
                                key={item.href}
                                href={item.href}
                                cta={item.cta}
                                section="header_menu"
                                onClick={closeMenu}
                                aria-current={isCurrent(item.href) ? "page" : undefined}
                                className={cn(
                                  "flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-accent/60",
                                  isCurrent(item.href) && "bg-accent/40"
                                )}
                              >
                                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-purple-300" aria-hidden="true" />
                                <span className="flex flex-col gap-0.5">
                                  <span className="text-sm font-medium text-foreground">{item.name}</span>
                                  <span className="text-xs leading-snug text-muted-foreground">
                                    {item.description}
                                  </span>
                                </span>
                              </TrackedLink>
                            ))}
                          </nav>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>

                  <Separator className="my-3" />

                  <TrackedLink
                    href={docsLink}
                    cta="docs"
                    section="header_menu"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={closeMenu}
                    className="flex items-center gap-3 rounded-md p-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                  >
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                    Docs
                  </TrackedLink>

                  <Separator className="my-3" />

                  <nav className="flex flex-col">
                    {legalNavItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMenu}
                        aria-current={isCurrent(item.href) ? "page" : undefined}
                        className={cn(
                          "rounded-md p-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
                          isCurrent(item.href) && "text-foreground"
                        )}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </nav>
                </div>

                <div className="border-t border-white/[0.08] p-4">
                  <div className="flex items-center gap-1">
                    {socialLinks.map((social) => {
                      const Icon = socialIcons[social.name];
                      return (
                        <Button key={social.href} asChild variant="ghost" size="icon">
                          <TrackedLink
                            href={social.href}
                            cta={social.cta}
                            section="header_menu"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={closeMenu}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
                            <span className="sr-only">{social.name}</span>
                          </TrackedLink>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
