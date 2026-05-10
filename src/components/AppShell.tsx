"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  APP_NAME,
  APP_TAGLINE,
  PRIMARY_NAV,
  TOOLS_NAV,
  isAnyActive,
  isNavItemActive,
  type NavItem,
} from "@/lib/nav";
import {
  isLeague,
  LAST_LEAGUE_KEY,
  leagueFromPathname,
  type League,
} from "@/lib/league";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MAX_WIDTHS = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
  "7xl": "max-w-7xl",
} as const;

type MaxWidth = keyof typeof MAX_WIDTHS;

export function AppShell({
  children,
  maxWidth = "7xl",
}: {
  children: React.ReactNode;
  maxWidth?: MaxWidth;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      {/* Wrapper holds main + footer so pb-24 clears the fixed BottomTabBar
          for the LAST in-flow element on the page (the footer). */}
      <div className="pb-24">
        <main
          className={cn(
            "mx-auto w-full px-4 py-6 sm:px-6 sm:py-8",
            MAX_WIDTHS[maxWidth],
          )}
        >
          {children}
        </main>
        <Footer />
      </div>
      <BottomTabBar />
    </div>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("font-bold tracking-tight leading-tight", className)}>
      <span className="text-primary">VEX</span>{" "}
      <span className="text-brand-orange">Hub</span>
    </span>
  );
}

function TopBar() {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur",
        "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5",
        "after:bg-linear-to-r after:from-brand-orange after:via-primary after:to-brand-orange",
        "after:opacity-70",
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 py-2.5 sm:px-6 sm:py-3">
        <Link
          href="/"
          aria-label={APP_NAME}
          className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80"
        >
          <Image
            src="/logo.svg"
            alt=""
            width={32}
            height={32}
            priority
            className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
          />
          <BrandMark className="text-base sm:text-lg" />
        </Link>
      </div>
    </header>
  );
}

function BottomTabBar() {
  const pathname = usePathname();
  const eventsHref = useEventsHref(pathname);
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="mx-auto flex w-full max-w-2xl items-stretch justify-around gap-1 px-2 py-1.5">
        {PRIMARY_NAV.map((item) => {
          // Events tab points at the user's current/last league when known.
          const overrideHref = item.href === "/" ? eventsHref : undefined;
          return (
            <TabLink
              key={item.href}
              item={item}
              pathname={pathname}
              overrideHref={overrideHref}
            />
          );
        })}
        <MoreTab pathname={pathname} />
      </div>
    </nav>
  );
}

/**
 * Pick the best href for the Events tab.
 * - On a league page (`/v5/...`) → stay in that league
 * - Otherwise read last-picked league from localStorage
 * - Fall back to `/` (the league picker) if neither applies
 */
function useEventsHref(pathname: string): string {
  const currentLeague = leagueFromPathname(pathname);
  const [lastLeague, setLastLeague] = useState<League | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(LAST_LEAGUE_KEY);
      if (v && isLeague(v)) setLastLeague(v);
    } catch {
      // ignore
    }
  }, []);

  const league = currentLeague ?? lastLeague;
  return league ? `/${league}` : "/";
}

function TabLink({
  item,
  pathname,
  overrideHref,
}: {
  item: NavItem;
  pathname: string;
  overrideHref?: string;
}) {
  const active = isNavItemActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      href={overrideHref ?? item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 transition-colors",
        active
          ? "text-brand-orange"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 transition-transform",
          active && "scale-110",
        )}
      />
      <span
        className={cn(
          "text-[10px] font-medium leading-none",
          active && "font-semibold",
        )}
      >
        {item.label}
      </span>
      {active && (
        <span className="absolute -top-1.5 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-brand-orange" />
      )}
    </Link>
  );
}

function MoreTab({ pathname }: { pathname: string }) {
  const active = isAnyActive(TOOLS_NAV, pathname);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More menu"
        className={cn(
          "group relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-primary/40",
          active
            ? "text-brand-orange"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <MoreHorizontal
          className={cn(
            "h-5 w-5 shrink-0 transition-transform",
            active && "scale-110",
          )}
        />
        <span
          className={cn(
            "text-[10px] font-medium leading-none",
            active && "font-semibold",
          )}
        >
          More
        </span>
        {active && (
          <span className="absolute -top-1.5 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-brand-orange" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="end"
        sideOffset={12}
        className="mb-2 min-w-56"
      >
        <DropdownMenuLabel>More tools</DropdownMenuLabel>
        {TOOLS_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = isNavItemActive(item, pathname);
          return (
            <DropdownMenuItem key={item.href} active={isActive} asChild>
              <Link href={item.href}>
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-brand-orange" : "text-primary",
                  )}
                />
                <span>{item.label}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Footer() {
  return (
    <footer className="mt-10 border-t border-border/60">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1">
            <BrandMark className="text-sm" />
            <p className="max-w-xl text-xs text-muted-foreground leading-relaxed">
              {`${APP_TAGLINE} Find your team's events, scout opponents, compare awards, and check competition eligibility — all in one place.`}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Data from RobotEvents API · Not affiliated with REC Foundation
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Standard page title row. Pages can compose their own content after this.
 * Use `actions` for page-level buttons on the right side.
 */
export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
