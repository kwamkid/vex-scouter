"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Info, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Level = {
  program: "VEX IQ" | "VEX V5" | "VEX U";
  division: "Elementary" | "Middle School" | "High School" | "University";
  // Maximum age at the May 1 cutoff. Null = no maximum (VEX U).
  maxAge: number | null;
  // Minimum age at the May 1 cutoff. Null = no minimum.
  minAge: number | null;
  desc: string;
  // Tailwind color tokens — the program brand color used for the badge.
  badgeClass: string;
  iconText: string;
  note?: string;
};

// Source: VEX IQ Mix & Match and VEX V5 Push Back Game Manuals (2025-2026).
// Cutoff: age on May 1 of the Worlds year.
const LEVELS: Level[] = [
  {
    program: "VEX IQ",
    division: "Elementary",
    maxAge: 12,
    minAge: null,
    desc: "Elementary school division",
    badgeClass: "bg-[#006BB4] text-white",
    iconText: "IQ",
  },
  {
    program: "VEX IQ",
    division: "Middle School",
    maxAge: 15,
    minAge: null,
    desc: "Middle school division",
    badgeClass: "bg-[#006BB4] text-white",
    iconText: "IQ",
  },
  {
    program: "VEX V5",
    division: "Middle School",
    maxAge: 15,
    minAge: null,
    desc: "Middle school division",
    badgeClass: "bg-primary text-primary-foreground",
    iconText: "V5",
  },
  {
    program: "VEX V5",
    division: "High School",
    maxAge: 19,
    minAge: null,
    desc: "High school division",
    badgeClass: "bg-primary text-primary-foreground",
    iconText: "V5",
  },
  {
    program: "VEX U",
    division: "University",
    maxAge: null,
    minAge: 16,
    desc: "University division — must be enrolled in college/university",
    badgeClass: "bg-[#6B21A8] text-white",
    iconText: "U",
    note: "Requires university enrollment",
  },
];

function getCurrentSeason(today: Date): {
  seasonName: string;
  worldsYear: number;
} {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  if (month >= 5) {
    return { seasonName: `${year}-${year + 1}`, worldsYear: year + 1 };
  }
  return { seasonName: `${year - 1}-${year}`, worldsYear: year };
}

// Age on May 1 of the Worlds year. Returns null if birth date is invalid.
function ageAtCutoff(birth: Date, worldsYear: number): number {
  let age = worldsYear - birth.getFullYear();
  // If born after May 1, subtract one — they haven't had that birthday yet by cutoff.
  if (birth.getMonth() > 4 || (birth.getMonth() === 4 && birth.getDate() > 1)) {
    age -= 1;
  }
  return age;
}

// Last season the student is still age-eligible for `maxAge`.
function lastEligibleSeason(birth: Date, maxAge: number): string {
  let lastWorlds: number;
  if (birth.getMonth() > 4 || (birth.getMonth() === 4 && birth.getDate() > 1)) {
    lastWorlds = birth.getFullYear() + maxAge + 1;
  } else {
    lastWorlds = birth.getFullYear() + maxAge;
  }
  return `${lastWorlds - 1}-${lastWorlds}`;
}

function isEligible(level: Level, age: number): boolean {
  if (level.maxAge !== null && age > level.maxAge) return false;
  if (level.minAge !== null && age < level.minAge) return false;
  return true;
}

export function AgeCheckView() {
  const [birthdate, setBirthdate] = useState("");

  const today = useMemo(() => new Date(), []);
  const todayStr = today.toISOString().split("T")[0];

  const season = useMemo(() => getCurrentSeason(today), [today]);

  const parsed = useMemo(() => {
    if (!birthdate) return null;
    // Parse as local date — `new Date('YYYY-MM-DD')` is UTC midnight which
    // can shift the day in negative-offset zones. Build it explicitly.
    const [y, m, d] = birthdate.split("-").map(Number);
    if (!y || !m || !d) return null;
    const birth = new Date(y, m - 1, d);
    if (Number.isNaN(birth.getTime())) return null;
    return { birth, age: ageAtCutoff(birth, season.worldsYear) };
  }, [birthdate, season.worldsYear]);

  return (
    <div className="space-y-5">
      <SeasonBadge seasonName={season.seasonName} worldsYear={season.worldsYear} />

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <label
          htmlFor="ac-birthdate"
          className="mb-2 block text-sm font-semibold text-foreground"
        >
          Student birth date
        </label>
        <input
          id="ac-birthdate"
          type="date"
          value={birthdate}
          max={todayStr}
          onChange={(e) => setBirthdate(e.target.value)}
          className={cn(
            "w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground",
            "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
          )}
        />

        {parsed && (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-primary">
                  Age at VEX Worlds {season.worldsYear}
                </div>
                <div className="text-2xl font-bold text-foreground sm:text-3xl">
                  {parsed.age} <span className="text-sm font-medium text-muted-foreground">years</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Cutoff: May 1, {season.worldsYear}
              </div>
            </div>
          </div>
        )}
      </section>

      {parsed && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Trophy className="h-4 w-4 text-brand-orange" />
            Eligible competition levels
          </h2>
          <div className="grid gap-3">
            {LEVELS.map((level) => (
              <LevelCard
                key={`${level.program}-${level.division}`}
                level={level}
                age={parsed.age}
                birth={parsed.birth}
              />
            ))}
          </div>
        </section>
      )}

      <InfoBox />
    </div>
  );
}

function SeasonBadge({
  seasonName,
  worldsYear,
}: {
  seasonName: string;
  worldsYear: number;
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-4 py-3 text-center shadow-sm",
        "bg-linear-to-r from-brand-orange to-primary text-primary-foreground",
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide opacity-90">
        Current season
      </div>
      <div className="text-xl font-bold leading-tight sm:text-2xl">
        {seasonName}
      </div>
      <div className="text-xs opacity-90">VEX Worlds {worldsYear}</div>
    </div>
  );
}

function LevelCard({
  level,
  age,
  birth,
}: {
  level: Level;
  age: number;
  birth: Date;
}) {
  const eligible = isEligible(level, age);
  const lastSeason =
    eligible && level.maxAge !== null ? lastEligibleSeason(birth, level.maxAge) : null;

  let constraint: string;
  if (level.maxAge !== null) {
    constraint = `Age ≤ ${level.maxAge} on May 1`;
  } else if (level.minAge !== null) {
    constraint = `Age ≥ ${level.minAge}, university enrollment`;
  } else {
    constraint = "";
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm transition-opacity",
        eligible ? "border-border" : "border-border/60 opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg leading-none",
              level.badgeClass,
            )}
          >
            <span className="text-[8px] font-bold tracking-wider">VEX</span>
            <span className="text-lg font-extrabold">{level.iconText}</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground sm:text-base">
              {level.program} {level.division}
            </div>
            <div className="text-xs text-muted-foreground">{level.desc}</div>
            {constraint && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {constraint}
              </div>
            )}
          </div>
        </div>
        <Badge variant={eligible ? "brand" : "muted"} className="shrink-0">
          {eligible ? "Eligible" : "Not eligible"}
        </Badge>
      </div>

      {lastSeason && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 text-primary" />
          Last eligible season:{" "}
          <span className="font-mono font-semibold text-primary">
            {lastSeason}
          </span>
        </div>
      )}
      {level.note && !lastSeason && eligible && (
        <div className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          {level.note}
        </div>
      )}
    </div>
  );
}

function InfoBox() {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Info className="h-4 w-4 text-primary" />
        Official age criteria
      </h3>
      <ul className="space-y-1.5 text-xs text-muted-foreground sm:text-sm">
        <li>
          VEX uses <span className="font-semibold text-foreground">May 1</span>{" "}
          of the Worlds year as the age cutoff.
        </li>
        <li>Elementary students may &quot;play up&quot; into Middle School.</li>
        <li>Middle School students may &quot;play up&quot; into High School.</li>
        <li>Eligibility is based on age, not grade level.</li>
      </ul>
      <p className="mt-3 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
        Source: VEX IQ Mix &amp; Match and VEX V5 Push Back Game Manuals
        (2025–2026).
      </p>
    </section>
  );
}
