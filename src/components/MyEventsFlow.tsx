"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Calendar,
  Loader2,
  MapPin,
  Search,
  ChevronRight,
  ChevronDown,
  History,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorAlert } from "@/components/ui/error-alert";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { countryFlag } from "@/lib/country-flags";
import { leagueFromProgram } from "@/lib/league";
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

export function MyEventsFlow({
  lockedProgram,
}: {
  /**
   * When set, the program is locked to this code (e.g. "V5RC") and the
   * division dropdown only shows that program's grades. Used by league
   * routes (/v5, /iq) so the user doesn't see the cross-program switcher.
   */
  lockedProgram?: ProgramCode;
} = {}) {
  // ---------------------------------------------------------------------
  // URL-driven state
  //
  // The URL is the source of truth for the active search: `?team=2999B&season=...`.
  // Form submit pushes a new URL; the URL change re-triggers the fetch.
  // This makes results bookmarkable, deep-linkable, and back-button-friendly.
  // localStorage just remembers the last-used team between fresh visits.
  // ---------------------------------------------------------------------
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTeam = (searchParams.get("team") ?? "").toUpperCase();
  const urlSeasonRaw = searchParams.get("season");
  const urlSeasonId =
    urlSeasonRaw && Number.isFinite(Number(urlSeasonRaw))
      ? Number(urlSeasonRaw)
      : null;

  const watchlist = useWatchlist();

  const initialDivision: DivisionOption = lockedProgram
    ? (DIVISION_OPTIONS.find((d) => d.program === lockedProgram) ??
      DEFAULT_DIVISION)
    : DEFAULT_DIVISION;
  const [division, setDivision] = useState<DivisionOption>(initialDivision);
  const [teamNumber, setTeamNumber] = useState(urlTeam);
  const [seasonId, setSeasonId] = useState<number | null>(urlSeasonId);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const { seasons, loading: seasonsLoading } = useSeasons(division.program);

  // Mirror URL → input state. Fires on initial mount and whenever the URL
  // changes externally (back/forward navigation), so the inputs always
  // reflect what's in the URL.
  useEffect(() => {
    setTeamNumber(urlTeam);
  }, [urlTeam]);
  useEffect(() => {
    if (urlSeasonId != null) setSeasonId(urlSeasonId);
  }, [urlSeasonId]);

  // Default season once seasons load, only if URL didn't pin one.
  useEffect(() => {
    if (seasons.length === 0) return;
    if (seasonId && seasons.some((s) => s.id === seasonId)) return;
    setSeasonId(pickDefaultSeasonId(seasons));
  }, [seasons, seasonId]);

  // First-mount only: if URL has no `team`, hydrate the input from the last
  // saved team in localStorage (if it matches the locked program). Doesn't
  // push the URL — user explicitly submits to start a search.
  const didHydrate = useRef(false);
  useEffect(() => {
    if (didHydrate.current) return;
    didHydrate.current = true;
    if (urlTeam) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        program?: ProgramCode;
        grade?: GradeLevel;
        team?: string;
      };
      if (saved.program && saved.grade) {
        if (!lockedProgram || saved.program === lockedProgram) {
          const d = findDivision(saved.program, saved.grade);
          if (d) setDivision(d);
        }
      }
      if (saved.team) setTeamNumber(saved.team);
    } catch {
      // ignore malformed localStorage
    }
  }, [urlTeam, lockedProgram]);

  const runLookup = useCallback(
    (teamRaw: string, season: number, program: ProgramCode) => {
      const t = teamRaw.trim().toUpperCase();
      if (!t) return;
      setError(null);
      setResult(null);
      start(async () => {
        try {
          const res = await fetch(
            `/api/my-events?team=${encodeURIComponent(t)}&program=${program}&season=${season}`,
          );
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "lookup failed");
          setResult(json as LookupResult);
        } catch (err) {
          setError((err as Error).message);
        }
      });
    },
    [],
  );

  // Fetch driven entirely by URL params. Refires whenever team/season change
  // in the URL — including the back button after visiting an event page.
  useEffect(() => {
    if (!urlTeam || !urlSeasonId) return;
    runLookup(urlTeam, urlSeasonId, division.program);
  }, [urlTeam, urlSeasonId, division.program, runLookup]);

  // Push a new search to the URL. Used by both form submit and quick-select
  // chips below. Falls out silently if the season hasn't loaded yet.
  const pushSearch = useCallback(
    (rawTeam: string) => {
      const t = rawTeam.trim().toUpperCase();
      if (!t || !seasonId) return;

      // Save fallback for the next fresh visit (no URL params).
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            program: division.program,
            grade: division.grade,
            team: t,
          }),
        );
      } catch {
        // ignore quota / privacy errors
      }

      const params = new URLSearchParams();
      params.set("team", t);
      params.set("season", String(seasonId));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [division.program, division.grade, pathname, router, seasonId],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    pushSearch(teamNumber);
  }

  // Favorited teams scoped to this league (or all favorites in non-locked
  // mode). Drives the quick-select chip row above the team input.
  const favorites = useMemo(
    () =>
      watchlist.items.filter(
        (f) => !lockedProgram || f.program.toUpperCase() === lockedProgram,
      ),
    [watchlist.items, lockedProgram],
  );

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-3">
        {/* When a league is locked, grade is irrelevant for the API
            (my-events takes program + season + team) and the team's actual
            grade comes back in the lookup response, so we hide the picker
            and only show Season. */}
        {lockedProgram ? (
          <SeasonSelect
            seasons={seasons}
            value={seasonId}
            onChange={setSeasonId}
            loading={seasonsLoading}
          />
        ) : (
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
        )}

        {favorites.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Favorites
            </span>
            <div className="flex flex-wrap gap-1.5">
              {favorites.map((f) => {
                const isActive =
                  f.teamNumber.toUpperCase() === teamNumber.trim().toUpperCase();
                return (
                  <button
                    key={`${f.program}-${f.teamNumber}`}
                    type="button"
                    onClick={() => pushSearch(f.teamNumber)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-xs font-semibold transition-colors",
                      isActive
                        ? "border-brand-orange/60 bg-brand-orange-soft text-foreground"
                        : "border-border bg-card text-foreground hover:border-brand-orange/40 hover:bg-brand-orange-soft/50",
                    )}
                    title={f.teamName ?? undefined}
                  >
                    <Star
                      className={cn(
                        "h-3 w-3",
                        isActive
                          ? "fill-brand-orange text-brand-orange"
                          : "text-brand-orange",
                      )}
                    />
                    {f.teamNumber}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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

      {error && <ErrorAlert message={error} />}

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
        <EmptyState
          title={
            bucket === "ongoing"
              ? "No ongoing events right now."
              : bucket === "upcoming"
                ? "No upcoming events scheduled."
                : "No past events this season."
          }
        />
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
    <li
      className={cn(
        // Status-colored 4px left bar via thick left border, regular border
        // on the other 3 sides. Combined with bg tint, this gives each card
        // a glance-readable status without screaming.
        "rounded-lg border border-l-4 transition-colors hover:border-primary/30",
        past
          ? "border-border/50 border-l-muted-foreground/30 bg-muted/30"
          : ongoing
            ? "border-brand-orange/40 border-l-brand-orange bg-brand-orange-soft/30"
            : "border-border border-l-primary/70 bg-card",
      )}
    >
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title — always strong/dark so the event name leads. The "past"
              status is conveyed by the muted card bg (above) + the bucket
              tab the user is on, so we don't dim the title further. */}
          <Link
            href={scoutHref}
            className="block text-[15px] font-semibold leading-snug text-foreground line-clamp-2 hover:text-primary sm:text-base"
          >
            {event.name}
          </Link>

          {/* Meta row: date + level/status badges sit together so the eye
              picks up "when + what kind" in one glance. Location goes on
              its own line so long venue names can wrap. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
            {start && (
              <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                <Calendar className="h-3.5 w-3.5 text-brand-orange" />
                {formatRange(start, end)}
              </span>
            )}
            {ongoing && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-orange">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-orange opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-orange" />
                </span>
                Live
              </span>
            )}
            {event.level && <LevelBadge level={event.level} />}
          </div>

          {location && (
            <div className="flex items-start gap-1 text-[12px] text-muted-foreground">
              {event.location?.country ? (
                <span
                  className="shrink-0 leading-none"
                  aria-label={event.location.country}
                  title={event.location.country}
                >
                  {countryFlag(event.location.country)}
                </span>
              ) : (
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              )}
              <span className="line-clamp-1">{location}</span>
            </div>
          )}

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
            accent={leagueFromProgram(programCode) ?? undefined}
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

// Color a level pill by its prestige tier so users can scan for "World" or
// "Signature" at a glance. Falls back to neutral muted for unknown values.
function LevelBadge({ level }: { level: string }) {
  const tone = levelTone(level);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone,
      )}
    >
      {level}
    </span>
  );
}

function levelTone(level: string): string {
  const l = level.toLowerCase();
  if (l.includes("world")) {
    return "border-tier-gold/60 bg-tier-gold/10 text-tier-gold";
  }
  if (l.includes("national")) {
    return "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400";
  }
  if (l.includes("signature")) {
    return "border-primary/40 bg-primary/10 text-primary";
  }
  if (l.includes("regional") || l.includes("state") || l.includes("province")) {
    return "border-tier-bronze/50 bg-tier-bronze/10 text-tier-bronze";
  }
  if (l.includes("league")) {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  return "border-border bg-muted/40 text-muted-foreground";
}
