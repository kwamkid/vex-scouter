"use client";

import { Award as AwardIcon, Calendar, Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Award } from "@/lib/robotevents/schemas";

// Minimal event shape needed by award rendering — anything broader would
// couple this module to the specific API response shape upstream.
export type AwardEvent = {
  id: number;
  name: string;
  start?: string | null;
  end?: string | null;
  level?: string | null;
};

export type AwardEventGroup = {
  event: AwardEvent;
  awards: Award[];
};

/**
 * Group awards by their event. Events kept in input order (caller is
 * responsible for sorting upstream — usually by date desc); awards within
 * each event sorted by prestige (Excellence first). Events without awards
 * are skipped so the section stays focused.
 */
export function groupAwardsByEvent<
  E extends { event: AwardEvent; awards: Award[] },
>(events: E[]): AwardEventGroup[] {
  const groups: AwardEventGroup[] = [];
  for (const e of events) {
    if (e.awards.length === 0) continue;
    const sorted = [...e.awards].sort(
      (a, b) => awardTier(a.title) - awardTier(b.title),
    );
    groups.push({ event: e.event, awards: sorted });
  }
  return groups;
}

// Lower tier number = more prestigious. Used purely for ordering within a
// single event — `awardDisplay()` decides the visual treatment.
export function awardTier(title: string): number {
  if (/excellence/i.test(title)) return 1;
  if (/tournament champion/i.test(title)) return 2;
  if (/tournament finalist/i.test(title)) return 3;
  if (/design/i.test(title)) return 4;
  if (/judges/i.test(title)) return 5;
  if (/think/i.test(title)) return 6;
  if (/innovate/i.test(title)) return 6;
  return 9;
}

/**
 * Bigger, richer treatment than a small Badge: includes a tier label so the
 * gold/silver/bronze hierarchy is legible at a glance.
 */
export function awardDisplay(title: string): {
  variant: "gold" | "silver" | "bronze" | "outline";
  icon: React.ReactNode;
  tierLabel: string;
} {
  if (/excellence/i.test(title))
    return {
      variant: "gold",
      icon: <Trophy className="h-5 w-5" />,
      tierLabel: "Top Honor",
    };
  if (/tournament champion/i.test(title))
    return {
      variant: "silver",
      icon: <Trophy className="h-5 w-5" />,
      tierLabel: "Champion",
    };
  if (/tournament finalist/i.test(title))
    return {
      variant: "bronze",
      icon: <Medal className="h-5 w-5" />,
      tierLabel: "Finalist",
    };
  if (/design/i.test(title))
    return {
      variant: "silver",
      icon: <Medal className="h-5 w-5" />,
      tierLabel: "Judged Award",
    };
  if (/judges/i.test(title))
    return {
      variant: "bronze",
      icon: <Medal className="h-5 w-5" />,
      tierLabel: "Judged Award",
    };
  if (/think|innovate|create|amaze|build|sportsmanship|inspire/i.test(title))
    return {
      variant: "bronze",
      icon: <AwardIcon className="h-5 w-5" />,
      tierLabel: "Judged Award",
    };
  return {
    variant: "outline",
    icon: <AwardIcon className="h-5 w-5" />,
    tierLabel: "Award",
  };
}

export function EventAwardsCard({
  event,
  awards,
}: {
  event: AwardEvent;
  awards: Award[];
}) {
  const start = event.start ? new Date(event.start) : null;
  return (
    <li className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="border-b border-border/60 bg-muted/30 px-3 py-2">
        <div className="text-sm font-semibold text-foreground line-clamp-2">
          {event.name}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          {start && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {start.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
          {event.level && <span>· {event.level}</span>}
        </div>
      </header>
      <ul className="divide-y divide-border/50">
        {awards.map((a) => (
          <AwardItem key={a.id} title={a.title} />
        ))}
      </ul>
    </li>
  );
}

export function AwardItem({ title }: { title: string }) {
  const { variant, icon, tierLabel } = awardDisplay(title);
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
          variant === "gold" &&
            "border-tier-gold/60 bg-tier-gold/15 text-tier-gold",
          variant === "silver" &&
            "border-tier-silver/60 bg-tier-silver/15 text-tier-silver",
          variant === "bronze" &&
            "border-tier-bronze/60 bg-tier-bronze/15 text-tier-bronze",
          variant === "outline" &&
            "border-border bg-muted/50 text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider",
            variant === "gold" && "text-tier-gold",
            variant === "silver" && "text-tier-silver",
            variant === "bronze" && "text-tier-bronze",
            variant === "outline" && "text-muted-foreground",
          )}
        >
          {tierLabel}
        </div>
      </div>
    </li>
  );
}
