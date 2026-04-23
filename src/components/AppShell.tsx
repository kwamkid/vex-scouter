"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP_NAME, NAV_ITEMS, isNavItemActive } from "@/lib/nav";

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
      <main className={cn("mx-auto w-full px-4 py-6 sm:px-6 sm:py-8", MAX_WIDTHS[maxWidth])}>
        {children}
      </main>
      <footer className="mt-8 pb-8 text-center text-[11px] text-muted-foreground">
        Data from RobotEvents API · Not affiliated with REC Foundation
      </footer>
    </div>
  );
}

function TopBar() {
  const pathname = usePathname();
  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur",
        // Subtle orange-to-red underline gives the chrome a branded accent
        // without changing the primary red.
        "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5",
        "after:bg-linear-to-r after:from-brand-orange after:via-primary after:to-brand-orange",
        "after:opacity-70",
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <Image
            src="/logo.svg"
            alt=""
            width={36}
            height={36}
            priority
            className="shrink-0"
          />
          <div className="min-w-0 hidden sm:block">
            <div className="text-sm font-bold tracking-tight leading-tight">
              <span className="text-primary">VEX</span>{" "}
              <span className="text-foreground">Worlds</span>{" "}
              <span className="text-brand-orange">Match Scout</span>
            </div>
            <div className="text-[10px] text-muted-foreground leading-tight">
              {APP_NAME}
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV_ITEMS.map((item) => {
            const active = isNavItemActive(item, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
                  active
                    ? "bg-brand-orange-soft text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-brand-orange" : "text-primary",
                  )}
                />
                <span className="hidden sm:inline">{item.label}</span>
                {active && (
                  <span className="absolute inset-x-2 -bottom-2.75 hidden h-0.5 rounded-full bg-brand-orange sm:block" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
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
        <div className="flex items-center gap-2">
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
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
