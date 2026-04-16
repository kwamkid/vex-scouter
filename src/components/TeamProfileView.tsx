"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
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
import { countryFlag } from "@/lib/country-flags";
import type { Award, Team } from "@/lib/robotevents/schemas";

const STORAGE_KEY = "vex-scout:my-team";

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
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [seasonsLoading, setSeasonsLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Load saved team number.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { team?: string };
        if (saved.team) setTeamNumber(saved.team);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load all seasons (across all programs).
  useEffect(() => {
    setSeasonsLoading(true);
    Promise.all([
      fetch("/api/seasons?program=V5RC").then((r) => r.json()),
      fetch("/api/seasons?program=VIQRC").then((r) => r.json()),
    ])
      .then(([v5, iq]) => {
        const all = [
          ...((v5.seasons ?? []) as SeasonOption[]),
          ...((iq.seasons ?? []) as SeasonOption[]),
        ];
        // Deduplicate by id and sort by start desc.
        const map = new Map<number, SeasonOption>();
        for (const s of all) map.set(s.id, s);
        const unique = [...map.values()].sort((a, b) => {
          const aT = a.start ? new Date(a.start).getTime() : 0;
          const bT = b.start ? new Date(b.start).getTime() : 0;
          return bT - aT;
        });
        setSeasons(unique);
        // Default: most recent started season.
        const now = Date.now();
        const started = unique.find(
          (s) => s.start && new Date(s.start).getTime() <= now,
        );
        setSeasonId(started?.id ?? unique[0]?.id ?? null);
      })
      .catch(() => setSeasons([]))
      .finally(() => setSeasonsLoading(false));
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = teamNumber.trim().toUpperCase();
    if (!t || !seasonId) return;
    setError(null);
    setProfile(null);
    start(async () => {
      try {
        const qs = new URLSearchParams({
          team: t,
          season: String(seasonId),
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
            {!seasonsLoading &&
              seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {shortSeason(s.name)}
                </option>
              ))}
          </select>
        </label>

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

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="break-all">{error}</span>
        </div>
      )}

      {pending && (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading team profile…
        </div>
      )}

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
        <StatBox label="Events" value={data.totalEvents} />
        <StatBox label="Awards" value={data.totalAwards} />
        <StatBox label="Best Skills" value={data.bestSkillsScore ?? "—"} />
        <StatBox label="Best Prog" value={data.bestProg ?? "—"} />
        <StatBox label="Best Driver" value={data.bestDriver ?? "—"} />
        <StatBox label="Best Rank" value={data.bestEventRank ?? "—"} />
      </div>

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
          <StatBox
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
          <StatBox label="Skills" value={skillsScore} />
        )}
        {progScore != null && <StatBox label="Prog" value={progScore} />}
        {driverScore != null && <StatBox label="Driver" value={driverScore} />}
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

function StatBox({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="font-mono text-sm font-semibold text-foreground">
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
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
