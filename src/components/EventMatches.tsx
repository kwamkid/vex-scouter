"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Stat } from "@/components/ui/stat";
import { ProgressLoader } from "./ProgressLoader";
import {
  MatchVIARow,
  cooperativeScore,
  isCooperativeMatch,
  isPlayed,
  type RowTeamStatMap,
} from "./MatchVIARow";
import { consumeNdjson } from "@/lib/stream";
import type { Match, MatchAlliance } from "@/lib/robotevents/schemas";
import type { EventTeamStat } from "@/lib/robotevents/events";
import type { TeamRow } from "@/types";
import type { TeamInfoMap } from "./TeamMatchHistory";

type StreamMsg =
  | { type: "progress"; stage: string; label: string; percent: number }
  | {
      type: "result";
      data: {
        matches: Match[];
        stats: Record<string, EventTeamStat>;
        source: "cache" | "live";
        cachedAt?: number;
        status: "past" | "ongoing" | "upcoming" | "unknown";
      };
    }
  | { type: "error"; message: string };

type EventStatsMap = Map<number, EventTeamStat>;

type DisplayStat = {
  source: "event" | "season";
  rank: number | null;
  wins: number;
  losses: number;
  ties: number;
  skillsScore: number | null;
  progScore: number | null;
  driverScore: number | null;
  skillsRank: number | null;
  wp?: number;
  ap?: number;
  awp?: number | null;
};

// Build a stat to display. Prefer event-local data; fall back to scouted
// season data when the event hasn't produced rankings/skills yet.
function pickStat(
  teamId: number,
  eventStats: EventStatsMap,
  scouted?: Map<number, TeamRow>,
): DisplayStat | null {
  const ev = eventStats.get(teamId);
  const hasEvent =
    ev != null &&
    (ev.rank != null ||
      ev.skillsScore != null ||
      ev.wins > 0 ||
      ev.losses > 0 ||
      ev.ties > 0);
  if (hasEvent && ev) {
    return {
      source: "event",
      rank: ev.rank,
      wins: ev.wins,
      losses: ev.losses,
      ties: ev.ties,
      skillsScore: ev.skillsScore,
      progScore: ev.progScore,
      driverScore: ev.driverScore,
      skillsRank: ev.skillsRank,
      wp: ev.wp,
      ap: ev.ap,
      awp: ev.awp,
    };
  }
  const row = scouted?.get(teamId);
  if (row) {
    return {
      source: "season",
      rank: row.bestEventRank,
      wins: 0,
      losses: 0,
      ties: 0,
      skillsScore: row.skillsScore,
      progScore: row.progScore,
      driverScore: row.driverScore,
      skillsRank: row.skillsWorldRank,
    };
  }
  return null;
}

// All matches a team plays at a given event, with per-team stats *for this
// event* (skills score, current rank, W-L-T) shown next to each team.
export function EventMatches({
  eventId,
  myTeamId,
  myTeamNumber,
  teamNames,
  scoutedById,
  accent,
  refreshTick = 0,
  onMetaChange,
  teamLinkBuilder,
}: {
  eventId: number;
  myTeamId: number;
  myTeamNumber: string;
  teamNames?: TeamInfoMap;
  /** Season-wide scouted rows used as fallback when event stats are empty. */
  scoutedById?: Map<number, TeamRow>;
  /** "iq" | "v5" — drives accent color through summary panel + my-team badge. */
  accent?: "iq" | "v5";
  /** Bumped by parent to trigger a force-refresh (bypasses Upstash cache). */
  refreshTick?: number;
  /** Reports cache + load state to parent so it can render header chrome. */
  onMetaChange?: (meta: {
    loading: boolean;
    fromCache: boolean;
    cachedAt: number | null;
  }) => void;
  /** Returns a URL to switch the matches view to another team, or null. */
  teamLinkBuilder?: (teamNumber: string) => string | null;
}) {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [stats, setStats] = useState<EventStatsMap>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ percent: number; label: string }>(
    { percent: 0, label: "Starting…" },
  );
  const [fromCache, setFromCache] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  // Report load/cache state up so EventScoutView can render the cached
  // badge + refresh icon alongside the back button instead of inside us.
  useEffect(() => {
    onMetaChange?.({ loading, fromCache, cachedAt });
  }, [loading, fromCache, cachedAt, onMetaChange]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setProgress({ percent: 0, label: "Starting…" });
    setFromCache(false);

    const force = refreshTick > 0;
    const url = `/api/events/${eventId}/my-event?teamId=${myTeamId}${force ? "&refresh=1" : ""}`;

    consumeNdjson<StreamMsg>(
      url,
      (msg) => {
        if (msg.type === "progress") {
          setProgress({ percent: msg.percent, label: msg.label });
        } else if (msg.type === "result") {
          setMatches(msg.data.matches);
          const map: EventStatsMap = new Map();
          for (const [k, v] of Object.entries(msg.data.stats)) {
            map.set(Number(k), v);
          }
          setStats(map);
          setFromCache(msg.data.source === "cache");
          setCachedAt(msg.data.cachedAt ?? null);
          setLoading(false);
        } else if (msg.type === "error") {
          setError(msg.message);
          setLoading(false);
        }
      },
      { signal: ctrl.signal },
    ).catch((e) => {
      if (ctrl.signal.aborted) return;
      setError((e as Error).message);
      setLoading(false);
    });

    return () => ctrl.abort();
  }, [eventId, myTeamId, refreshTick]);

  const {
    upcoming,
    past,
    myStat,
    eventStarted,
    cooperativeEvent,
    teamStatsMap,
    userAvgScore,
  } = useMemo(() => {
    const all = matches ?? [];
    const u: Match[] = [];
    const p: Match[] = [];
    for (const m of all) {
      if (isPlayed(m)) p.push(m);
      else u.push(m);
    }
    const sortKey = (m: Match) =>
      m.round * 10000 + (m.instance ?? 0) * 1000 + m.matchnum;
    u.sort((a, b) => sortKey(a) - sortKey(b));
    p.sort((a, b) => sortKey(a) - sortKey(b));
    // VIQRC teamwork has no red-vs-blue split; if no match in the event has
    // both colors, treat the whole event as cooperative.
    const coop = all.length > 0 && all.every(isCooperativeMatch);

    // Per-team avg score across played matches at this event. Works for
    // both cooperative (shared score per match) and competitive (the team's
    // alliance score). Aggregates first so we can attach to the rank/skill
    // stats below.
    const sumByTeam = new Map<number, { sum: number; n: number }>();
    for (const m of p) {
      for (const al of m.alliances) {
        const s = al.score;
        if (s == null) continue;
        for (const t of al.teams ?? []) {
          const cur = sumByTeam.get(t.team.id) ?? { sum: 0, n: 0 };
          cur.sum += s;
          cur.n += 1;
          sumByTeam.set(t.team.id, cur);
        }
      }
    }

    // Build a teamId → { rank, skillsRank, skillsScore, avgMatchScore } lookup
    // so each row can render compact stats under each team cell. Only the
    // teams that appear in this match list are included.
    const tsMap: RowTeamStatMap = new Map();
    const seenTeams = new Set<number>();
    for (const m of all) {
      for (const al of m.alliances) {
        for (const t of al.teams ?? []) {
          if (seenTeams.has(t.team.id)) continue;
          seenTeams.add(t.team.id);
          const ds = pickStat(t.team.id, stats, scoutedById);
          const agg = sumByTeam.get(t.team.id);
          const avg = agg && agg.n > 0 ? agg.sum / agg.n : null;
          if (ds || avg != null) {
            tsMap.set(t.team.id, {
              rank: ds?.rank ?? null,
              skillsRank: ds?.skillsRank ?? null,
              skillsScore: ds?.skillsScore ?? null,
              avgMatchScore: avg,
            });
          }
        }
      }
    }

    // For cooperative matches, avg the user's played match scores at this
    // event — rendered under the score column. Skips for V5 (per-side scores).
    let avg: number | null = null;
    if (coop) {
      const myScores: number[] = [];
      for (const m of p) {
        const involved = m.alliances.some((al) =>
          (al.teams ?? []).some((t) => t.team.id === myTeamId),
        );
        if (!involved) continue;
        const s = cooperativeScore(m);
        if (s != null) myScores.push(s);
      }
      if (myScores.length) {
        avg = myScores.reduce((a, b) => a + b, 0) / myScores.length;
      }
    }

    return {
      upcoming: u,
      past: p,
      myStat: pickStat(myTeamId, stats, scoutedById),
      teamStatsMap: tsMap,
      userAvgScore: avg,
      // Event "started" means at least one team has rankings/skills logged.
      eventStarted: stats.size > 0,
      cooperativeEvent: coop,
    };
  }, [matches, stats, myTeamId, scoutedById]);

  if (loading) {
    return (
      <ProgressLoader
        percent={progress.percent}
        label={progress.label}
        fromCache={fromCache}
      />
    );
  }
  if (error) {
    return <ErrorAlert message={error} size="md" />;
  }
  if (!matches || matches.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No matches scheduled for{" "}
        <span className="font-mono text-primary">{myTeamNumber}</span> at this
        event yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!eventStarted && (
        <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-brand-orange" />
          <span>
            Event hasn&apos;t started yet — showing each team&apos;s{" "}
            <span className="font-semibold">season stats</span> as a guide. Live
            event ranks &amp; skills will replace these once the event begins.
          </span>
        </div>
      )}

      {myStat && (
        <MyTeamSummary
          teamNumber={myTeamNumber}
          stat={myStat}
          skillsParticipants={countSkillsParticipants(stats)}
          cooperative={cooperativeEvent}
          accent={accent}
          cooperativeAvgScore={userAvgScore}
        />
      )}

      {upcoming.length > 0 && (
        <MatchSection
          title="Upcoming"
          matches={upcoming}
          myTeamNumber={myTeamNumber}
          teamNames={teamNames}
          accent={accent}
          teamStats={teamStatsMap}
          teamLinkBuilder={teamLinkBuilder}
        />
      )}

      {past.length > 0 && (
        <MatchSection
          title="Played"
          matches={past}
          myTeamNumber={myTeamNumber}
          teamNames={teamNames}
          accent={accent}
          teamStats={teamStatsMap}
          teamLinkBuilder={teamLinkBuilder}
        />
      )}
    </div>
  );
}

function MyTeamSummary({
  teamNumber,
  stat,
  skillsParticipants,
  cooperative = false,
  accent,
  cooperativeAvgScore,
}: {
  teamNumber: string;
  stat: DisplayStat;
  skillsParticipants: number;
  /** VIQRC events: TW score = cooperative match avg; competitive uses W-L-T. */
  cooperative?: boolean;
  /** "iq" | "v5" — controls accent color (panel border, team# text). */
  accent?: "iq" | "v5";
  /** Cooperative-only: avg of the user's played match scores at this event. */
  cooperativeAvgScore?: number | null;
}) {
  const eventScope = stat.source === "event";
  const isIq = accent === "iq";

  // 2-row layout: Teamwork on top, Skills below. Each row = [Rank | Score].
  const twRank = stat.rank != null ? `#${stat.rank}` : "—";
  // Cooperative TW "score" = avg of played match scores. Competitive TW
  // "score" doesn't have a single canonical number; W-L-T is the closest
  // human-readable summary so we use that.
  const twScore = cooperative
    ? cooperativeAvgScore != null
      ? `${Math.round(cooperativeAvgScore)}`
      : "—"
    : eventScope
      ? `${stat.wins}-${stat.losses}-${stat.ties}`
      : "—";

  const skRank =
    stat.skillsRank != null
      ? skillsParticipants > 0 && eventScope
        ? `#${stat.skillsRank}/${skillsParticipants}`
        : `#${stat.skillsRank}`
      : "—";

  // SK score = combined best (prog+driver) with breakdown in parens.
  let skScore: React.ReactNode = "—";
  if (stat.skillsScore != null) {
    skScore = (
      <span className="inline-flex items-baseline gap-1">
        <span>{stat.skillsScore}</span>
        {(stat.progScore != null || stat.driverScore != null) && (
          <span className="text-[10px] font-normal text-muted-foreground">
            (PROG:{stat.progScore ?? 0}/DRV:{stat.driverScore ?? 0})
          </span>
        )}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3",
        eventScope
          ? isIq
            ? "border-[#006BB4]/40 bg-[#006BB4]/5"
            : "border-brand-orange/40 bg-brand-orange-soft/40"
          : "border-border/60 bg-muted/30",
      )}
    >
      <div className="mb-2 flex items-baseline gap-2 text-xs text-muted-foreground">
        <span>{eventScope ? "Your event stats" : "Your season stats"}</span>
        <span
          className={cn(
            "font-mono font-semibold",
            isIq ? "text-[#006BB4]" : "text-primary",
          )}
        >
          {teamNumber}
        </span>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr_auto_1fr]">
        {/* Row 1: Teamwork */}
        <Stat
          label="TW Rank"
          value={twRank}
          tooltip={
            cooperative
              ? "Current teamwork rank in your division at this event."
              : "Current rank in your division, ordered by WP → AP → SP."
          }
        />
        <Stat
          label={cooperative ? "TW Score" : "W-L-T"}
          value={twScore}
          tooltip={
            cooperative
              ? "Your average cooperative match score at this event."
              : "Wins · Losses · Ties at this event."
          }
        />
        {/* Row 2: Skills */}
        <Stat
          label="SK Rank"
          value={skRank}
          tooltip={
            eventScope
              ? "Your skills rank at this event."
              : "Best skills rank this season."
          }
        />
        <Stat
          label="SK Score"
          value={skScore}
          tooltip="Combined best programming + driver runs."
        />
      </div>
    </div>
  );
}

function countSkillsParticipants(stats: EventStatsMap): number {
  let n = 0;
  for (const s of stats.values()) {
    if (s.skillsScore != null) n++;
  }
  return n;
}


function MatchSection({
  title,
  matches,
  myTeamNumber,
  teamNames,
  accent,
  teamStats,
  teamLinkBuilder,
}: {
  title: string;
  matches: Match[];
  myTeamNumber: string;
  teamNames?: TeamInfoMap;
  accent?: "iq" | "v5";
  teamStats?: RowTeamStatMap;
  teamLinkBuilder?: (teamNumber: string) => string | null;
}) {
  return (
    <section>
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <span className="font-mono text-xs text-muted-foreground">
          {matches.length}
        </span>
      </header>
      <ul className="flex flex-col rounded-md border border-border/60 overflow-hidden">
        {matches.map((m) => (
          <MatchVIARow
            key={m.id}
            match={m}
            myTeamNumber={myTeamNumber}
            teamNames={teamNames}
            accent={accent}
            teamStats={teamStats}
            teamLinkBuilder={teamLinkBuilder}
          />
        ))}
      </ul>
    </section>
  );
}


export function formatRelative(timestampMs: number): string {
  const diff = Date.now() - timestampMs;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
