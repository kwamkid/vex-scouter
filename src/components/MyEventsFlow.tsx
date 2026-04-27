"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Calendar,
  Loader2,
  MapPin,
  Search,
  ChevronRight,
  ChevronDown,
  History,
  AlertTriangle,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TeamMatchHistory } from "./TeamMatchHistory";
import { useWatchlist } from "@/lib/watchlist";
import {
  DIVISION_OPTIONS,
  findDivision,
  type DivisionOption,
  type GradeLevel,
  type ProgramCode,
} from "@/lib/robotevents/programs";
import type { EventRef, Team } from "@/lib/robotevents/schemas";
import { SeasonSelect, pickDefaultSeasonId, useSeasons } from "./SeasonSelect";

const STORAGE_KEY = "vex-scout:my-team";
const DEFAULT_DIVISION = findDivision("V5RC", "Middle School")!;

type LookupResult = {
  team: Team;
  season: { id: number; name: string };
  events: EventRef[];
};

export function MyEventsFlow() {
  const [division, setDivision] = useState<DivisionOption>(DEFAULT_DIVISION);
  const [teamNumber, setTeamNumber] = useState("");
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const { seasons, loading: seasonsLoading } = useSeasons(division.program);

  useEffect(() => {
    // Whenever program changes, default to the most recent started season.
    if (seasons.length === 0) return;
    if (seasonId && seasons.some((s) => s.id === seasonId)) return;
    setSeasonId(pickDefaultSeasonId(seasons));
  }, [seasons, seasonId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          program?: ProgramCode;
          grade?: GradeLevel;
          team?: string;
        };
        if (saved.program && saved.grade) {
          const d = findDivision(saved.program, saved.grade);
          if (d) setDivision(d);
        }
        if (saved.team) setTeamNumber(saved.team);
      }
    } catch {
      // ignore malformed localStorage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          program: division.program,
          grade: division.grade,
          team: teamNumber,
        }),
      );
    } catch {
      // ignore quota/privacy errors
    }
  }, [division, teamNumber, hydrated]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = teamNumber.trim().toUpperCase();
    if (!t) return;
    setError(null);
    setResult(null);
    start(async () => {
      try {
        const seasonQs = seasonId ? `&season=${seasonId}` : "";
        const res = await fetch(
          `/api/my-events?team=${encodeURIComponent(t)}&program=${division.program}${seasonQs}`,
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "lookup failed");
        setResult(json as LookupResult);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DivisionSelect
            value={division.key}
            onChange={(key) => {
              const next = DIVISION_OPTIONS.find((d) => d.key === key);
              if (next) {
                setDivision(next);
                setSeasonId(null);
              }
            }}
          />
          <SeasonSelect
            seasons={seasons}
            value={seasonId}
            onChange={setSeasonId}
            loading={seasonsLoading}
          />
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Your team number
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              value={teamNumber}
              onChange={(e) => setTeamNumber(e.target.value)}
              placeholder="e.g. 2989A"
              autoFocus
              spellCheck={false}
              className="flex h-11 flex-1 rounded-md border border-input bg-background px-3 text-base font-mono uppercase text-foreground placeholder:text-muted-foreground placeholder:normal-case focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              type="submit"
              size="lg"
              disabled={pending || !teamNumber.trim()}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Find events</span>
            </Button>
          </div>
        </label>
      </form>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="break-all">{error}</span>
        </div>
      )}

      {result && (
        <EventsList
          result={result}
          programCode={division.program}
          seasonId={seasonId}
        />
      )}
    </div>
  );
}

function DivisionSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Division
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {DIVISION_OPTIONS.map((d) => (
          <option key={d.key} value={d.key}>
            {d.label} — {d.grade}
          </option>
        ))}
      </select>
    </label>
  );
}

type EventBucket = "upcoming" | "ongoing" | "past";

function EventsList({
  result,
  programCode,
  seasonId,
}: {
  result: LookupResult;
  programCode: ProgramCode;
  seasonId: number | null;
}) {
  const { team, events, season } = result;

  const { past, ongoing, upcoming } = useMemo(() => {
    const now = Date.now();
    const p: EventRef[] = [];
    const o: EventRef[] = [];
    const u: EventRef[] = [];
    for (const e of events) {
      const start = e.start ? new Date(e.start).getTime() : 0;
      const end = e.end ? new Date(e.end).getTime() : start;
      if (end < now) p.push(e);
      else if (start <= now && end >= now) o.push(e);
      else u.push(e);
    }
    // Past: most recent first. Upcoming: soonest first (server already asc).
    p.reverse();
    return { past: p, ongoing: o, upcoming: u };
  }, [events]);

  // Default to the first bucket that has data: ongoing > upcoming > past.
  const defaultBucket: EventBucket =
    ongoing.length > 0 ? "ongoing" : upcoming.length > 0 ? "upcoming" : "past";
  const [bucket, setBucket] = useState<EventBucket>(defaultBucket);

  // If the fetched events change (new lookup), reset to the sensible default.
  useEffect(() => {
    setBucket(defaultBucket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id]);

  const visible =
    bucket === "past" ? past : bucket === "ongoing" ? ongoing : upcoming;

  const watchlist = useWatchlist();
  const isWatched = watchlist.has(team.number, programCode);

  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-lg font-bold text-primary">
              {team.number}
            </span>
            <span className="text-sm text-foreground truncate">
              {team.team_name ?? "—"}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground truncate">
            {team.organization ?? ""}
            {team.organization && team.location?.country ? " · " : ""}
            {[team.location?.city, team.location?.country]
              .filter(Boolean)
              .join(", ")}
          </div>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground truncate">
            Season: {season.name}
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            watchlist.toggle({
              teamId: team.id,
              teamNumber: team.number,
              teamName: team.team_name ?? null,
              program: programCode,
            })
          }
          aria-pressed={isWatched}
          title={isWatched ? "Remove from watchlist" : "Save to watchlist"}
          className={cn(
            "shrink-0 inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
            isWatched
              ? "border-brand-orange/60 bg-brand-orange-soft text-foreground"
              : "border-border text-muted-foreground hover:border-brand-orange/50 hover:text-foreground",
          )}
        >
          <Star
            className={cn(
              "h-3.5 w-3.5",
              isWatched ? "fill-brand-orange text-brand-orange" : "",
            )}
          />
          <span className="hidden sm:inline">
            {isWatched ? "Watching" : "Watch"}
          </span>
        </button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/30 p-1">
        <BucketTab
          active={bucket === "ongoing"}
          onClick={() => setBucket("ongoing")}
          label="Ongoing"
          count={ongoing.length}
        />
        <BucketTab
          active={bucket === "upcoming"}
          onClick={() => setBucket("upcoming")}
          label="Upcoming"
          count={upcoming.length}
        />
        <BucketTab
          active={bucket === "past"}
          onClick={() => setBucket("past")}
          label="Past"
          count={past.length}
        />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {bucket === "ongoing" && "No ongoing events right now."}
          {bucket === "upcoming" && "No upcoming events scheduled."}
          {bucket === "past" && "No past events this season."}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              myTeam={team.number}
              myTeamId={team.id}
              programCode={programCode}
              seasonId={seasonId}
              bucket={bucket}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function BucketTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "ml-1.5 font-mono text-[10px]",
          active ? "text-primary" : "text-muted-foreground/70",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function EventCard({
  event,
  myTeam,
  myTeamId,
  programCode,
  seasonId,
  bucket,
}: {
  event: EventRef;
  myTeam: string;
  myTeamId: number;
  programCode: ProgramCode;
  seasonId: number | null;
  bucket: EventBucket;
}) {
  const start = event.start ? new Date(event.start) : null;
  const end = event.end ? new Date(event.end) : null;
  const ongoing = bucket === "ongoing";
  const past = bucket === "past";
  const hasHistory = ongoing || past;
  const [expanded, setExpanded] = useState(false);

  const location = [
    event.location?.venue,
    event.location?.city,
    event.location?.region,
    event.location?.country,
  ]
    .filter(Boolean)
    .join(", ");

  const scoutHref = `/events/${event.id}?myTeam=${encodeURIComponent(myTeam)}&program=${programCode}${seasonId ? `&season=${seasonId}` : ""}`;

  return (
    <li className="rounded-lg border border-border bg-card transition-colors hover:border-primary/30">
      <div className="flex items-start gap-3 p-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {ongoing && (
              <Badge variant="brand" className="text-[10px]">
                Ongoing
              </Badge>
            )}
            {past && (
              <Badge variant="muted" className="text-[10px]">
                Past
              </Badge>
            )}
            {event.level && (
              <Badge variant="muted" className="text-[10px]">
                {event.level}
              </Badge>
            )}
          </div>
          <Link
            href={scoutHref}
            className="block text-sm font-medium text-foreground line-clamp-2 hover:text-primary"
          >
            {event.name}
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {start && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatRange(start, end)}
              </span>
            )}
            {location && (
              <span className="flex items-center gap-1 min-w-0">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{location}</span>
              </span>
            )}
          </div>

          {hasHistory && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                "mt-1 inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-brand-orange/50 hover:bg-brand-orange-soft hover:text-foreground",
                expanded &&
                  "border-brand-orange/50 bg-brand-orange-soft text-foreground",
              )}
            >
              <History className="h-3 w-3 text-brand-orange" />
              {expanded ? "Hide" : "Match history"}
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  expanded && "rotate-180",
                )}
              />
            </button>
          )}
        </div>
        <Link
          href={scoutHref}
          className="shrink-0 self-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label="Scout this event"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {hasHistory && expanded && (
        <div className="border-t border-border/60 p-3">
          <TeamMatchHistory
            eventId={event.id}
            teamId={myTeamId}
            teamNumber={myTeam}
          />
        </div>
      )}
    </li>
  );
}

function formatRange(start: Date, end: Date | null): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  const s = start.toLocaleDateString("en-US", opts);
  if (!end || start.toDateString() === end.toDateString()) return s;
  const e = end.toLocaleDateString("en-US", opts);
  return `${s} – ${e}`;
}
