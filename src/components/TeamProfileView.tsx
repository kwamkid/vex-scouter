"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Calendar,
  Loader2,
  MapPin,
  Building2,
  Search,
  Trophy,
  Medal,
  Award as AwardIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { Stat } from "@/components/ui/stat";
import { countryFlag } from "@/lib/country-flags";
import { PROGRAMS, type ProgramCode } from "@/lib/robotevents/programs";
import type { Award, Team } from "@/lib/robotevents/schemas";
import { EventAwardsCard, groupAwardsByEvent } from "./EventAwards";

const STORAGE_KEY = "vex-scout:my-team";

// Friendly name shown in the program dropdown. Full label like
// "VEX IQ Robotics Competition" is too long for a select.
const PROGRAM_DISPLAY: Record<ProgramCode, string> = {
  VIQRC: "VEX IQ",
  V5RC: "VEX V5",
  VURC: "VEX U",
  VAIRC: "VEX AI",
};

// Order the user sees in the dropdown — IQ first since it's the largest base
// in our user pool, V5 second, then college / AI.
const PROGRAM_ORDER: ProgramCode[] = ["VIQRC", "V5RC", "VURC", "VAIRC"];

const DEFAULT_PROGRAM: ProgramCode = "VIQRC";

type SeasonOption = { id: number; name: string; start?: string | null };

type EventSummary = {
  event: {
    id: number;
    name: string;
    start?: string | null;
    level?: string | null;
  };
  rank: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  progScore: number | null;
  driverScore: number | null;
  skillsScore: number | null;
  awards: Award[];
};

type ProfileData = {
  team: Team;
  season: { id: number; name: string };
  totalAwards: number;
  totalEvents: number;
  bestSkillsScore: number | null;
  bestProg: number | null;
  bestDriver: number | null;
  bestEventRank: number | null;
  events: EventSummary[];
};

export function TeamProfileView() {
  const [teamNumber, setTeamNumber] = useState("");
  const [programCode, setProgramCode] = useState<ProgramCode>(DEFAULT_PROGRAM);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [seasonsLoading, setSeasonsLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Load saved team number + program.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { team?: string; program?: string };
        if (saved.team) setTeamNumber(saved.team);
        if (
          saved.program &&
          PROGRAMS.some((p) => p.code === saved.program)
        ) {
          setProgramCode(saved.program as ProgramCode);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Load seasons for the selected program. Reload when the user switches
  // program (e.g. V5RC → VIQRC) so the season list matches.
  useEffect(() => {
    setSeasonsLoading(true);
    setSeasons([]);
    setSeasonId(null);
    fetch(`/api/seasons?program=${encodeURIComponent(programCode)}`)
      .then((r) => r.json())
      .then((json) => {
        const list = (json.seasons ?? []) as SeasonOption[];
        const sorted = [...list].sort((a, b) => {
          const aT = a.start ? new Date(a.start).getTime() : 0;
          const bT = b.start ? new Date(b.start).getTime() : 0;
          return bT - aT;
        });
        setSeasons(sorted);
        const now = Date.now();
        const started = sorted.find(
          (s) => s.start && new Date(s.start).getTime() <= now,
        );
        setSeasonId(started?.id ?? sorted[0]?.id ?? null);
      })
      .catch(() => setSeasons([]))
      .finally(() => setSeasonsLoading(false));
  }, [programCode]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = teamNumber.trim().toUpperCase();
    if (!t || !seasonId) return;
    setError(null);
    setProfile(null);
    // Persist team + program for next visit.
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ team: t, program: programCode }),
      );
    } catch {
      // ignore
    }
    start(async () => {
      try {
        const qs = new URLSearchParams({
          team: t,
          season: String(seasonId),
          program: programCode,
        });
        const res = await fetch(`/api/team-profile?${qs.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "lookup failed");
        setProfile(json as ProfileData);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Program
            </span>
            <select
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value as ProgramCode)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PROGRAM_ORDER.map((code) => (
                <option key={code} value={code}>
                  {PROGRAM_DISPLAY[code]} ({code})
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Season
            </span>
            <select
              value={seasonId ?? ""}
              onChange={(e) => setSeasonId(Number(e.target.value))}
              disabled={seasonsLoading || seasons.length === 0}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {seasonsLoading && <option>Loading…</option>}
              {!seasonsLoading && seasons.length === 0 && (
                <option>No seasons</option>
              )}
              {!seasonsLoading &&
                seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {shortSeason(s.name)}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={teamNumber}
            onChange={(e) => setTeamNumber(e.target.value)}
            placeholder="e.g. 2999K"
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
            <span className="hidden sm:inline">View profile</span>
          </Button>
        </div>
      </form>

      {error && <ErrorAlert message={error} size="md" />}

      {pending && <LoadingState size="md" label="Loading team profile…" />}

      {profile && <ProfileResult data={profile} />}
    </div>
  );
}

function ProfileResult({ data }: { data: ProfileData }) {
  const { team, events } = data;
  const loc = [
    team.location?.city,
    team.location?.region,
    team.location?.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-5">
      {/* Team header */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-2xl font-bold text-primary">
            {team.number}
          </span>
          <span className="text-lg font-semibold text-foreground">
            {team.team_name ?? "—"}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {team.organization && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" /> {team.organization}
            </span>
          )}
          {loc && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {countryFlag(team.location?.country)} {loc}
            </span>
          )}
          {team.grade && (
            <Badge variant="muted" className="text-[10px]">
              {team.grade}
            </Badge>
          )}
        </div>
        <div className="mt-2 text-[11px] font-mono text-muted-foreground">
          Season: {data.season.name}
        </div>
      </div>

      {/* Season stats */}
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-6">
        <Stat pill label="Events" value={data.totalEvents} />
        <Stat pill label="Awards" value={data.totalAwards} />
        <Stat pill label="Best Skills" value={data.bestSkillsScore ?? "—"} />
        <Stat pill label="Best Prog" value={data.bestProg ?? "—"} />
        <Stat pill label="Best Driver" value={data.bestDriver ?? "—"} />
        <Stat pill label="Best Rank" value={data.bestEventRank ?? "—"} />
      </div>

      {/* All awards across the season, grouped by event. Hidden when no
          awards so teams without trophies don't see an empty section. */}
      {data.totalAwards > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Awards ({data.totalAwards})
          </h3>
          <ul className="flex flex-col gap-2">
            {groupAwardsByEvent(events).map(({ event, awards }) => (
              <EventAwardsCard key={event.id} event={event} awards={awards} />
            ))}
          </ul>
        </section>
      )}

      {/* Per-event breakdown */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Events ({events.length})
        </h3>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No events this season.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {events.map((es) => (
              <EventCard key={es.event.id} summary={es} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}


function EventCard({ summary }: { summary: EventSummary }) {
  const {
    event,
    rank,
    wins,
    losses,
    ties,
    progScore,
    driverScore,
    skillsScore,
    awards,
  } = summary;
  const start = event.start ? new Date(event.start) : null;

  return (
    <li className="rounded-lg border border-border bg-card p-3 sm:p-4 space-y-2">
      <div>
        <div className="text-sm font-medium text-foreground">{event.name}</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1">
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
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rank != null && (
          <Stat pill
            label="Rank"
            value={
              <span>
                #{rank}
                {(wins != null || losses != null) && (
                  <span className="text-[10px] text-muted-foreground ml-1">
                    ({wins ?? 0}-{losses ?? 0}-{ties ?? 0})
                  </span>
                )}
              </span>
            }
          />
        )}
        {skillsScore != null && (
          <Stat pill label="Skills" value={skillsScore} />
        )}
        {progScore != null && <Stat pill label="Prog" value={progScore} />}
        {driverScore != null && <Stat pill label="Driver" value={driverScore} />}
      </div>

      {awards.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {awards.map((a) => {
            const v = awardVariant(a.title);
            return (
              <Badge key={a.id} variant={v.variant}>
                {v.icon}
                <span className="truncate">{a.title}</span>
              </Badge>
            );
          })}
        </div>
      )}
    </li>
  );
}


function awardVariant(title: string): {
  variant: "gold" | "silver" | "bronze" | "outline";
  icon: React.ReactNode;
} {
  if (/excellence/i.test(title))
    return { variant: "gold", icon: <Trophy className="h-3 w-3" /> };
  if (/tournament champion/i.test(title))
    return { variant: "silver", icon: <Medal className="h-3 w-3" /> };
  if (/tournament finalist/i.test(title))
    return { variant: "bronze", icon: <Medal className="h-3 w-3" /> };
  return { variant: "outline", icon: <AwardIcon className="h-3 w-3" /> };
}

function shortSeason(name: string): string {
  const match = name.match(/(\d{4}-\d{4}.*)$/);
  return match ? match[1] : name;
}
