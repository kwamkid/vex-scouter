"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Match } from "@/lib/robotevents/schemas";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import {
  MatchVIARow,
  cooperativeScore,
  isCooperativeMatch,
  type TeamInfoMap,
} from "./MatchVIARow";

export type { TeamInfo, TeamInfoMap } from "./MatchVIARow";

export function TeamMatchHistory({
  eventId,
  teamId,
  teamNumber,
  teamNames,
  compact = false,
  accent,
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
  /** "iq" | "v5" — passed through to MatchVIARow for accent color. */
  accent?: "iq" | "v5";
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
    return <LoadingState label="Loading matches…" />;
  }
  if (error) {
    return <ErrorAlert message={error} />;
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
          <MatchVIARow
            key={m.id}
            match={m}
            myTeamNumber={teamNumber}
            teamNames={effectiveNames}
            accent={accent}
          />
        ))}
      </ul>
    </div>
  );
}

// W/L/T from the user's perspective. We don't rely on the `scored` flag
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
