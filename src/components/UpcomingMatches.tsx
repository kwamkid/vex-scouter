"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Calendar, Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Match, MatchAlliance } from "@/lib/robotevents/schemas";
import type { TeamRow } from "@/types";
import type { TeamInfoMap } from "./TeamMatchHistory";

// Upcoming / in-progress matches for the user's team at an ongoing event.
// Each opponent row is annotated with the scout data (skills rank + score)
// we already have in memory, so the user can size them up at a glance.
export function UpcomingMatches({
  eventId,
  myTeamId,
  myTeamNumber,
  teamNames,
  scoutedById,
}: {
  eventId: number;
  myTeamId: number;
  myTeamNumber: string;
  teamNames?: TeamInfoMap;
  /** Scouted rows keyed by team id. Used to surface opponent skills rank/score. */
  scoutedById: Map<number, TeamRow>;
}) {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/events/${eventId}/team-matches?teamId=${myTeamId}`)
      .then(async (r) => {
        const json = await r.json();
        if (cancelled) return;
        if (!r.ok) throw new Error(json.error ?? "failed to load matches");
        setMatches(json.matches ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, myTeamId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your schedule…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span className="break-all">{error}</span>
      </div>
    );
  }
  if (!matches) return null;

  const upcoming = matches
    .filter((m) => !isPlayed(m))
    .sort(
      (a, b) =>
        a.round - b.round ||
        (a.instance ?? 0) - (b.instance ?? 0) ||
        a.matchnum - b.matchnum,
    );

  if (upcoming.length === 0) return null;

  return (
    <section className="rounded-xl border border-brand-orange/40 bg-brand-orange-soft/40 p-3 sm:p-4">
      <header className="mb-2 flex items-center gap-2">
        <Zap className="h-4 w-4 text-brand-orange" />
        <h3 className="text-sm font-semibold text-foreground">
          Next matches for{" "}
          <span className="font-mono text-primary">{myTeamNumber}</span>
        </h3>
        <Badge variant="muted" className="text-[10px]">
          {upcoming.length} queued
        </Badge>
      </header>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {upcoming.map((m) => (
          <UpcomingMatchRow
            key={m.id}
            match={m}
            myTeamId={myTeamId}
            myTeamNumber={myTeamNumber}
            teamNames={teamNames}
            scoutedById={scoutedById}
          />
        ))}
      </ul>
    </section>
  );
}

function UpcomingMatchRow({
  match,
  myTeamId,
  myTeamNumber,
  teamNames,
  scoutedById,
}: {
  match: Match;
  myTeamId: number;
  myTeamNumber: string;
  teamNames?: TeamInfoMap;
  scoutedById: Map<number, TeamRow>;
}) {
  const myAlliance = match.alliances.find((a) =>
    a.teams?.some((t) => t.team.id === myTeamId),
  );
  const oppAlliance = match.alliances.find((a) => a !== myAlliance);
  const scheduled = match.scheduled ? new Date(match.scheduled) : null;

  return (
    <li className="rounded-md border border-border bg-card p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-mono font-semibold text-foreground">
          {matchLabel(match)}
        </span>
        {scheduled && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatMatchTime(scheduled)}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        <AllianceLineup
          alliance={myAlliance}
          label="Us"
          mine
          myTeamId={myTeamId}
          myTeamNumber={myTeamNumber}
          teamNames={teamNames}
          scoutedById={scoutedById}
        />
        <AllianceLineup
          alliance={oppAlliance}
          label="Them"
          myTeamId={myTeamId}
          myTeamNumber={myTeamNumber}
          teamNames={teamNames}
          scoutedById={scoutedById}
        />
      </div>
    </li>
  );
}

function AllianceLineup({
  alliance,
  label,
  mine = false,
  myTeamId,
  myTeamNumber,
  teamNames,
  scoutedById,
}: {
  alliance?: MatchAlliance;
  label: string;
  mine?: boolean;
  myTeamId: number;
  myTeamNumber: string;
  teamNames?: TeamInfoMap;
  scoutedById: Map<number, TeamRow>;
}) {
  if (!alliance) {
    return <div className="text-xs text-muted-foreground/60">—</div>;
  }
  const color = alliance.color?.toLowerCase();
  const dotClass =
    color === "red"
      ? "bg-destructive"
      : color === "blue"
        ? "bg-blue-500"
        : "bg-muted-foreground";

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-md px-2 py-1.5 ring-inset",
        mine
          ? "bg-brand-orange-soft ring-1 ring-brand-orange/40"
          : "bg-muted/40",
      )}
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
        {label} · {alliance.color}
      </div>
      <ul className="flex flex-col">
        {(alliance.teams ?? []).map((t) => {
          const info = teamNames?.get(t.team.id);
          const number = info?.number ?? t.team.name ?? "—";
          const name = info?.name ?? null;
          const isMe =
            t.team.id === myTeamId ||
            number.toUpperCase() === myTeamNumber.toUpperCase();
          const scouted = scoutedById.get(t.team.id);

          return (
            <li
              key={t.team.id}
              className={cn(
                "flex items-baseline gap-2 text-[11px]",
                isMe && "font-semibold",
              )}
            >
              <span
                className={cn(
                  "font-mono w-16 shrink-0",
                  isMe ? "text-primary" : "text-foreground",
                )}
              >
                {isMe ? "▸" : ""}
                {number}
              </span>
              {name && (
                <span className="truncate text-muted-foreground min-w-0 flex-1">
                  {name}
                </span>
              )}
              {!isMe && scouted && (scouted.skillsScore != null || scouted.skillsWorldRank != null) ? (
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {scouted.skillsWorldRank != null && (
                    <span className="text-foreground">
                      #{scouted.skillsWorldRank}
                    </span>
                  )}
                  {scouted.skillsWorldRank != null &&
                    scouted.skillsScore != null &&
                    " · "}
                  {scouted.skillsScore != null && (
                    <span className="text-foreground">
                      {scouted.skillsScore}pt
                    </span>
                  )}
                </span>
              ) : !isMe ? (
                <span className="shrink-0 text-[10px] text-muted-foreground/50 italic">
                  not scouted
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function isPlayed(match: Match): boolean {
  if (match.scored === true) return true;
  for (const a of match.alliances) {
    if ((a.score ?? 0) > 0) return true;
  }
  return false;
}

function matchLabel(m: Match): string {
  const prefix =
    m.round === 1
      ? "P"
      : m.round === 2
        ? "Q"
        : m.round === 3
          ? "R16"
          : m.round === 4
            ? "QF"
            : m.round === 5
              ? "SF"
              : m.round === 6
                ? "F"
                : `R${m.round}`;
  if (m.round <= 2) return `${prefix}-${m.matchnum}`;
  const inst = m.instance ?? 1;
  return `${prefix}${inst}-${m.matchnum}`;
}

function formatMatchTime(d: Date): string {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return time;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${time}`;
}
