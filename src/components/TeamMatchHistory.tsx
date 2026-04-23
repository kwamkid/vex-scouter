"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Match, MatchAlliance } from "@/lib/robotevents/schemas";

export type TeamInfo = { number: string; name: string | null };
export type TeamInfoMap = Map<number, TeamInfo>;

export function TeamMatchHistory({
  eventId,
  teamId,
  teamNumber,
  teamNames,
  compact = false,
}: {
  eventId: number;
  teamId: number;
  teamNumber: string;
  /**
   * Optional lookup of team id → { number, name }. When provided, each team
   * in an alliance is shown with its full name.
   */
  teamNames?: TeamInfoMap;
  /** Dense layout for in-dialog use. */
  compact?: boolean;
}) {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/events/${eventId}/team-matches?teamId=${teamId}`)
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
  }, [eventId, teamId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading matches…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span className="break-all">{error}</span>
      </div>
    );
  }
  if (!matches || matches.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        No matches played yet.
      </div>
    );
  }

  const sorted = [...matches].sort(
    (a, b) =>
      a.round - b.round ||
      (a.instance ?? 0) - (b.instance ?? 0) ||
      a.matchnum - b.matchnum,
  );

  const wins = sorted.filter((m) => teamOutcome(m, teamId) === "W").length;
  const losses = sorted.filter((m) => teamOutcome(m, teamId) === "L").length;
  const ties = sorted.filter((m) => teamOutcome(m, teamId) === "T").length;

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span>
          <span className="font-mono text-foreground">{sorted.length}</span>{" "}
          matches
        </span>
        <span className="font-mono text-emerald-600 dark:text-emerald-400">{wins} W</span>
        <span className="font-mono text-destructive/80">{losses} L</span>
        {ties > 0 && (
          <span className="font-mono text-muted-foreground">{ties} T</span>
        )}
      </div>
      <ul className="flex flex-col rounded-md border border-border/60 overflow-hidden">
        {sorted.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            teamId={teamId}
            teamNumber={teamNumber}
            teamNames={teamNames}
          />
        ))}
      </ul>
    </div>
  );
}

function MatchCard({
  match,
  teamId,
  teamNumber,
  teamNames,
}: {
  match: Match;
  teamId: number;
  teamNumber: string;
  teamNames?: TeamInfoMap;
}) {
  const outcome = teamOutcome(match, teamId);
  const myAlliance = match.alliances.find((a) =>
    a.teams?.some((t) => t.team.id === teamId),
  );
  const oppAlliance = match.alliances.find((a) => a !== myAlliance);
  const resolved = outcome != null;

  const myScore = myAlliance?.score ?? 0;
  const oppScore = oppAlliance?.score ?? 0;
  const myWon = resolved && myScore > oppScore;
  const oppWon = resolved && oppScore > myScore;

  return (
    <li className="grid grid-cols-[3rem_1fr_2rem_1fr_5rem] items-center gap-2 px-2 py-1.5 border-b border-border/50 last:border-b-0">
      <span className="font-mono text-xs font-semibold text-foreground">
        {matchLabel(match)}
      </span>
      <AllianceCell
        alliance={myAlliance}
        myTeamNumber={teamNumber}
        teamNames={teamNames}
        winner={myWon}
        loser={oppWon}
      />
      <span className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        vs
      </span>
      <AllianceCell
        alliance={oppAlliance}
        myTeamNumber={teamNumber}
        teamNames={teamNames}
        winner={oppWon}
        loser={myWon}
      />
      <OutcomeBadge outcome={outcome} myScore={myScore} oppScore={oppScore} />
    </li>
  );
}

function OutcomeBadge({
  outcome,
  myScore,
  oppScore,
}: {
  outcome: "W" | "L" | "T" | null;
  myScore: number;
  oppScore: number;
}) {
  if (outcome == null) {
    return (
      <span className="text-right text-[10px] uppercase tracking-wide text-muted-foreground/60">
        Pending
      </span>
    );
  }
  const label =
    outcome === "W" ? "Win" : outcome === "L" ? "Loss" : "Tie";
  return (
    <div
      className={cn(
        "flex flex-col items-end text-[11px]",
        outcome === "W" && "text-emerald-600 dark:text-emerald-400",
        outcome === "L" && "text-destructive/80",
        outcome === "T" && "text-muted-foreground",
      )}
    >
      <span className="font-semibold">{label}</span>
      <span className="font-mono text-[10px] text-muted-foreground">
        {myScore}–{oppScore}
      </span>
    </div>
  );
}

function AllianceCell({
  alliance,
  myTeamNumber,
  teamNames,
  winner = false,
  loser = false,
}: {
  alliance?: MatchAlliance;
  myTeamNumber: string;
  teamNames?: TeamInfoMap;
  mine?: boolean;
  winner?: boolean;
  loser?: boolean;
}) {
  if (!alliance) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground/60">—</div>
    );
  }
  const color = alliance.color?.toLowerCase();
  const dotClass =
    color === "red"
      ? "bg-destructive"
      : color === "blue"
        ? "bg-blue-500"
        : "bg-muted-foreground";

  // Winner: 2px border in the winning alliance's color. Loser: no border
  // emphasis, just slight fade. No background tints anywhere.
  const winnerBorder =
    winner && color === "red"
      ? "border-destructive"
      : winner && color === "blue"
        ? "border-blue-500"
        : "";

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 min-w-0 rounded-md border-2",
        winner ? winnerBorder : "border-transparent",
        loser && "opacity-60",
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} />
      <ul className="flex flex-1 min-w-0 flex-col gap-0.5">
        {(alliance.teams ?? []).map((t) => {
          const info = teamNames?.get(t.team.id);
          const number = info?.number ?? t.team.name ?? "—";
          const name = info?.name ?? null;
          const isMe = number.toUpperCase() === myTeamNumber.toUpperCase();
          return (
            <li
              key={t.team.id}
              className="flex min-w-0 items-baseline gap-1.5 text-[11px]"
            >
              <span
                className={cn(
                  "font-mono shrink-0 w-16",
                  isMe
                    ? "font-bold text-primary"
                    : "text-foreground",
                )}
              >
                {isMe ? "▸" : ""}
                {number}
              </span>
              {name && (
                <span
                  className={cn(
                    "truncate text-[11px] flex-1 min-w-0",
                    isMe ? "text-foreground font-semibold" : "text-muted-foreground",
                  )}
                >
                  {name}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <span
        className={cn(
          "ml-2 shrink-0 font-mono text-base tabular-nums self-center",
          winner ? "font-bold text-foreground" : "text-muted-foreground",
        )}
      >
        {alliance.score ?? "—"}
      </span>
    </div>
  );
}

// Determine W/L/T from alliance scores. We don't rely on the `scored` flag
// because RE v2 doesn't always populate it; instead, if any alliance posted a
// non-zero score we treat the match as played.
function teamOutcome(match: Match, teamId: number): "W" | "L" | "T" | null {
  const mine = match.alliances.find((a) =>
    a.teams?.some((t) => t.team.id === teamId),
  );
  const opp = match.alliances.find((a) => a !== mine);
  if (!mine || !opp) return null;
  const mineScore = mine.score ?? 0;
  const oppScore = opp.score ?? 0;
  const played = match.scored === true || mineScore > 0 || oppScore > 0;
  if (!played) return null;
  if (mineScore > oppScore) return "W";
  if (mineScore < oppScore) return "L";
  return "T";
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
