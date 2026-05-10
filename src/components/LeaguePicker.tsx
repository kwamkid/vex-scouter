"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LAST_LEAGUE_KEY,
  LEAGUE_LABEL,
  LEAGUE_TAGLINE,
  LEAGUES,
  isLeague,
  type League,
} from "@/lib/league";

const LEAGUE_STYLE: Record<
  League,
  { accent: string; iconBg: string; mark: string }
> = {
  iq: {
    accent: "border-[#006BB4]/30 hover:border-[#006BB4]/60 hover:bg-[#006BB4]/5",
    iconBg: "bg-[#006BB4]",
    mark: "IQ",
  },
  v5: {
    accent: "border-primary/30 hover:border-primary/60 hover:bg-primary/5",
    iconBg: "bg-primary",
    mark: "V5",
  },
};

export function LeaguePicker() {
  const [lastLeague, setLastLeague] = useState<League | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(LAST_LEAGUE_KEY);
      if (v && isLeague(v)) setLastLeague(v);
    } catch {
      // ignore
    }
  }, []);

  function rememberAndGo(league: League) {
    try {
      localStorage.setItem(LAST_LEAGUE_KEY, league);
    } catch {
      // ignore
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {LEAGUES.map((league) => {
        const style = LEAGUE_STYLE[league];
        const isLast = lastLeague === league;
        return (
          <Link
            key={league}
            href={`/${league}`}
            onClick={() => rememberAndGo(league)}
            className={cn(
              "group relative flex items-center gap-4 rounded-xl border-2 bg-card p-5 shadow-sm transition-all sm:p-6",
              style.accent,
              isLast && "ring-2 ring-brand-orange/40",
            )}
          >
            <div
              className={cn(
                "flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl text-white shadow-sm",
                style.iconBg,
              )}
            >
              <span className="text-[9px] font-bold tracking-wider">VEX</span>
              <span className="text-2xl font-extrabold leading-none">
                {style.mark}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground sm:text-lg">
                  {LEAGUE_LABEL[league]}
                </h2>
                {isLast && (
                  <span className="rounded-full bg-brand-orange-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-orange">
                    Last
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {LEAGUE_TAGLINE[league]}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </Link>
        );
      })}
    </div>
  );
}
