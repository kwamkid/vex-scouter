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
  const [fetchedNames, setFetchedNames] = useState<TeamInfoMap | null>(null);
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
        const info = json.teamInfo as
          | Record<string, { number: string; name: string | null }>
          | undefined;
        if (info) {
          const m: TeamInfoMap = new Map();
          for (const [k, v] of Object.entries(info)) m.set(Number(k), v);
          setFetchedNames(m);
        }
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

  // Caller-provided names take precedence; fall back to the event-team map
  // we fetched from the API.
  const effectiveNames = teamNames ?? fetchedNames ?? undefined;

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

  const cooperative = sorted.length > 0 && sorted.every(isCooperativeMatch);
  const wins = sorted.filter((m) => teamOutcome(m, teamId) === "W").length;
  const losses = sorted.filter((m) => teamOutcome(m, teamId) === "L").length;
  const ties = sorted.filter((m) => teamOutcome(m, teamId) === "T").length;
  const playedCount = sorted.filter((m) => m.scored === true || cooperativeScore(m) != null).length;

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span>
          <span className="font-mono text-foreground">{sorted.length}</span>{" "}
          matches
        </span>
        {cooperative ? (
          <span className="font-mono text-brand-orange">
            {playedCount} played
          </span>
        ) : (
          <>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">{wins} W</span>
            <span className="font-mono text-destructive/80">{losses} L</span>
            {ties > 0 && (
              <span className="font-mono text-muted-foreground">{ties} T</span>
            )}
          </>
        )}
      </div>
      <ul className="flex flex-col rounded-md border border-border/60 overflow-hidden">
        {sorted.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            teamId={teamId}
            teamNumber={teamNumber}
            teamNames={effectiveNames}
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
  const cooperative = isCooperativeMatch(match);
  const rawOutcome = teamOutcome(match, teamId);
  // VIQRC: alliances cooperate, so suppress W/L/Tie even when the API reports
  // matching scores on both sides.
  const outcome = cooperative ? null : rawOutcome;
  // Fixed columns: blue alliance always left, red always right.
  const blueAlliance = match.alliances.find(
    (a) => a.color?.toLowerCase() === "blue",
  );
  const redAlliance = match.alliances.find(
    (a) => a.color?.toLowerCase() === "red",
  );
  const myAlliance = match.alliances.find((a) =>
    a.teams?.some((t) => t.team.id === teamId),
  );
  const oppAlliance = match.alliances.find((a) => a !== myAlliance);
  const myScore = myAlliance?.score ?? 0;
  const oppScore = oppAlliance?.score ?? 0;
  const blueScore = blueAlliance?.score ?? 0;
  const redScore = redAlliance?.score ?? 0;
  const played = rawOutcome != null || cooperativeScore(match) != null;
  const blueWon = !cooperative && played && blueScore > redScore;
  const redWon = !cooperative && played && redScore > blueScore;

  return (
    <li className="border-b border-border/50 last:border-b-0">
      <div
        className={cn(
          "flex flex-col gap-2 px-3 py-2.5",
          "lg:grid lg:grid-cols-[3rem_1fr_2rem_1fr_5rem] lg:items-center lg:gap-2 lg:px-2 lg:py-1.5",
        )}
      >
        <div className="flex items-center justify-between gap-3 lg:contents">
          <span className="font-mono text-xs font-semibold text-foreground">
            {matchLabel(match)}
          </span>
          <div className="lg:hidden">
            <OutcomeBadge
              outcome={outcome}
              myScore={myScore}
              oppScore={oppScore}
              cooperative={cooperative}
              played={played}
              sharedScore={cooperative ? blueScore || redScore : 0}
            />
          </div>
        </div>
        <AllianceCell
          alliance={blueAlliance}
          myTeamNumber={teamNumber}
          teamNames={teamNames}
          winner={blueWon}
          loser={redWon}
          hideScore={cooperative}
        />
        <span className="hidden text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 lg:block">
          {cooperative ? "&" : "vs"}
        </span>
        <AllianceCell
          alliance={redAlliance}
          myTeamNumber={teamNumber}
          teamNames={teamNames}
          winner={redWon}
          loser={blueWon}
          hideScore={cooperative}
        />
        <div className="hidden lg:block">
          <OutcomeBadge
            outcome={outcome}
            myScore={myScore}
            oppScore={oppScore}
            cooperative={cooperative}
            played={played}
            sharedScore={cooperative ? blueScore || redScore : 0}
          />
        </div>
      </div>
    </li>
  );
}

function OutcomeBadge({
  outcome,
  myScore,
  oppScore,
  cooperative = false,
  played = false,
  sharedScore = 0,
}: {
  outcome: "W" | "L" | "T" | null;
  myScore: number;
  oppScore: number;
  /** VIQRC: show shared score instead of W/L/Tie. */
  cooperative?: boolean;
  played?: boolean;
  sharedScore?: number;
}) {
  if (cooperative) {
    if (!played) {
      return (
        <span className="text-right text-[10px] uppercase tracking-wide text-muted-foreground/60">
          Pending
        </span>
      );
    }
    return (
      <div className="flex flex-col items-end text-[11px] text-brand-orange">
        <span className="font-semibold uppercase tracking-wide text-[10px]">
          Played
        </span>
        <span className="font-mono text-sm font-bold tabular-nums text-foreground">
          {sharedScore || "—"}
        </span>
      </div>
    );
  }
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
  hideScore = false,
}: {
  alliance?: MatchAlliance;
  myTeamNumber: string;
  teamNames?: TeamInfoMap;
  mine?: boolean;
  winner?: boolean;
  loser?: boolean;
  /** VIQRC: shared score is shown once in the outcome cell, not per side. */
  hideScore?: boolean;
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

  // Strong alliance bg = winner. Dim gray = loser. Light tint = pending.
  let bgClass = "";
  if (winner) {
    bgClass =
      color === "red"
        ? "bg-destructive/15"
        : color === "blue"
          ? "bg-blue-500/15"
          : "";
  } else if (loser) {
    bgClass = "bg-muted/40";
  } else {
    bgClass =
      color === "red"
        ? "bg-destructive/5"
        : color === "blue"
          ? "bg-blue-500/5"
          : "";
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-2 min-w-0 rounded-md sm:px-3",
        bgClass,
        loser && "opacity-70",
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
                  "font-mono shrink-0",
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
      {!hideScore && (
        <span
          className={cn(
            "ml-1 shrink-0 font-mono text-base tabular-nums self-center sm:ml-2",
            winner ? "font-bold text-foreground" : "text-muted-foreground",
          )}
        >
          {alliance.score ?? "—"}
        </span>
      )}
    </div>
  );
}

// VIQRC matches are cooperative: 2 teams share 1 score, no opposing alliance.
// In RobotEvents, VIQRC Mix & Match still returns red/blue alliances — but
// each alliance holds only 1 team and both alliances post the same shared
// score. V5RC always has ≥2 teams per alliance. Discriminate by team count.
function isCooperativeMatch(match: Match): boolean {
  if (match.alliances.length === 0) return false;
  if (match.alliances.length === 1) return true;
  return match.alliances.every((a) => (a.teams?.length ?? 0) <= 1);
}

function cooperativeScore(match: Match): number | null {
  for (const a of match.alliances) {
    if (a.score != null) return a.score;
  }
  return null;
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
