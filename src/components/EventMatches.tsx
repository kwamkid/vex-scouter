"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calendar, Info, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/tooltip";
import { ProgressLoader } from "./ProgressLoader";
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
}: {
  eventId: number;
  myTeamId: number;
  myTeamNumber: string;
  teamNames?: TeamInfoMap;
  /** Season-wide scouted rows used as fallback when event stats are empty. */
  scoutedById?: Map<number, TeamRow>;
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
  // Bumping this triggers a re-fetch with ?refresh=1 (bypasses Upstash cache).
  const [refreshTick, setRefreshTick] = useState(0);

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

  const { upcoming, past, myStat, eventStarted, cooperativeEvent } = useMemo(() => {
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
    return {
      upcoming: u,
      past: p,
      myStat: pickStat(myTeamId, stats, scoutedById),
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
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span className="break-all">{error}</span>
      </div>
    );
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
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-2">
          {fromCache && cachedAt != null && (
            <>
              <span className="rounded-sm border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                Cached
              </span>
              <span>updated {formatRelative(cachedAt)}</span>
            </>
          )}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRefreshTick((t) => t + 1)}
          disabled={loading}
          title="Bypass cache and re-fetch from RobotEvents"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", loading && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

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
        />
      )}

      {upcoming.length > 0 && (
        <MatchSection
          title="Upcoming"
          matches={upcoming}
          myTeamId={myTeamId}
          myTeamNumber={myTeamNumber}
          teamNames={teamNames}
          stats={stats}
          scoutedById={scoutedById}
        />
      )}

      {past.length > 0 && (
        <MatchSection
          title="Played"
          matches={past}
          myTeamId={myTeamId}
          myTeamNumber={myTeamNumber}
          teamNames={teamNames}
          stats={stats}
          scoutedById={scoutedById}
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
}: {
  teamNumber: string;
  stat: DisplayStat;
  skillsParticipants: number;
  /** VIQRC events: hide W-L-T/WP/AP/AWP — they don't apply to teamwork. */
  cooperative?: boolean;
}) {
  const eventScope = stat.source === "event";
  return (
    <div
      className={cn(
        "rounded-lg border p-3 sm:p-4",
        eventScope
          ? "border-brand-orange/40 bg-brand-orange-soft/40"
          : "border-border/60 bg-muted/30",
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{eventScope ? "Your event stats" : "Your season stats"}</span>
        <span className="font-mono font-semibold text-primary">
          {teamNumber}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Teamwork */}
        <section className="rounded-md border border-border/60 bg-background/60 p-3">
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Teamwork
          </h4>
          <div
            className={cn(
              "grid gap-3",
              cooperative ? "grid-cols-1" : "grid-cols-3 sm:grid-cols-5",
            )}
          >
            <Metric
              label={eventScope ? "Rank" : "Best Rank"}
              tip={
                eventScope
                  ? cooperative
                    ? "Current teamwork rank in your division at this event."
                    : "Current rank in your division at this event, ordered by WP → AP → SP."
                  : "Lowest (best) division rank you finished at any event this season."
              }
              value={stat.rank != null ? `#${stat.rank}` : "—"}
            />
            {!cooperative && (
              <Metric
                label="W-L-T"
                tip="Wins · Losses · Ties at this event."
                value={
                  eventScope
                    ? `${stat.wins}-${stat.losses}-${stat.ties}`
                    : "—"
                }
              />
            )}
            {!cooperative && eventScope && (
              <Metric
                label="WP"
                tip="Win Points: 2 per win, 1 per tie. Primary tiebreaker for division rank."
                value={stat.wp || "—"}
              />
            )}
            {!cooperative && eventScope && (
              <Metric
                label="AP"
                tip="Autonomous Points: 1 per match where your alliance won the autonomous bonus."
                value={stat.ap || "—"}
              />
            )}
            {!cooperative && eventScope && stat.awp != null && (
              <Metric
                label="AWP"
                tip="Autonomous Win Point: bonus WP awarded when your alliance completes the autonomous win requirements."
                value={stat.awp || "—"}
              />
            )}
          </div>
        </section>

        {/* Skills */}
        <section className="rounded-md border border-border/60 bg-background/60 p-3">
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Skills
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <Metric
              label="Rank"
              tip={
                eventScope
                  ? `Your skills rank at this event${skillsParticipants > 0 ? ` (out of ${skillsParticipants} teams who ran skills)` : ""}.`
                  : "Best skills rank from any event this season."
              }
              value={
                stat.skillsRank != null
                  ? skillsParticipants > 0 && eventScope
                    ? `#${stat.skillsRank}/${skillsParticipants}`
                    : `#${stat.skillsRank}`
                  : "—"
              }
            />
            <Metric
              label="Score"
              tip="Best programming + best driver run combined."
              value={stat.skillsScore != null ? stat.skillsScore : "—"}
            />
            <Metric
              label="Prog / Drv"
              tip="Best programming run · Best driver run (separately)."
              value={
                stat.progScore != null || stat.driverScore != null
                  ? `${stat.progScore ?? 0} / ${stat.driverScore ?? 0}`
                  : "—"
              }
            />
          </div>
        </section>
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

function Metric({
  label,
  value,
  tip,
}: {
  label: string;
  value: React.ReactNode;
  tip?: string;
}) {
  const labelNode = (
    <span className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
      {label}
      {tip && <Info className="h-2.5 w-2.5 opacity-60" />}
    </span>
  );
  return (
    <div className="flex flex-col">
      {tip ? (
        <InfoTooltip content={tip}>{labelNode}</InfoTooltip>
      ) : (
        labelNode
      )}
      <span className="font-mono text-sm font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

function MatchSection({
  title,
  matches,
  myTeamId,
  myTeamNumber,
  teamNames,
  stats,
  scoutedById,
}: {
  title: string;
  matches: Match[];
  myTeamId: number;
  myTeamNumber: string;
  teamNames?: TeamInfoMap;
  stats: EventStatsMap;
  scoutedById?: Map<number, TeamRow>;
}) {
  return (
    <section>
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <span className="font-mono text-[11px] text-muted-foreground">
          {matches.length}
        </span>
      </header>
      <ul className="flex flex-col rounded-md border border-border/60 overflow-hidden">
        {matches.map((m) => (
          <MatchRow
            key={m.id}
            match={m}
            myTeamId={myTeamId}
            myTeamNumber={myTeamNumber}
            teamNames={teamNames}
            stats={stats}
            scoutedById={scoutedById}
          />
        ))}
      </ul>
    </section>
  );
}

function MatchRow({
  match,
  myTeamId,
  myTeamNumber,
  teamNames,
  stats,
  scoutedById,
}: {
  match: Match;
  myTeamId: number;
  myTeamNumber: string;
  teamNames?: TeamInfoMap;
  stats: EventStatsMap;
  scoutedById?: Map<number, TeamRow>;
}) {
  // Fixed columns: blue alliance always on the left, red on the right.
  // The user's team can sit in either; the ▸ marker handles "us" emphasis.
  const blueAlliance = match.alliances.find(
    (a) => a.color?.toLowerCase() === "blue",
  );
  const redAlliance = match.alliances.find(
    (a) => a.color?.toLowerCase() === "red",
  );
  const myAlliance = match.alliances.find((a) =>
    a.teams?.some((t) => t.team.id === myTeamId),
  );
  const oppAlliance = match.alliances.find((a) => a !== myAlliance);
  const myScore = myAlliance?.score ?? 0;
  const oppScore = oppAlliance?.score ?? 0;
  const blueScore = blueAlliance?.score ?? 0;
  const redScore = redAlliance?.score ?? 0;
  const played = isPlayed(match);
  const cooperative = isCooperativeMatch(match);
  // VIQRC matches: both alliances cooperate for a shared score, so there is
  // no winner/loser/tie — even when scores happen to differ on the wire.
  const outcome: "W" | "L" | "T" | null = cooperative
    ? null
    : played
    ? myScore > oppScore
      ? "W"
      : myScore < oppScore
        ? "L"
        : "T"
    : null;
  const blueWon = !cooperative && played && blueScore > redScore;
  const redWon = !cooperative && played && redScore > blueScore;
  const scheduled = match.scheduled ? new Date(match.scheduled) : null;

  return (
    <li className="border-b border-border/50 last:border-b-0">
      <div
        className={cn(
          "flex flex-col gap-2 px-3 py-2.5",
          // Stack on phones/tablets; switch to the 5-column grid only when we
          // have real desktop room (lg = 1024px). Below that the cell content
          // (team list + stat pill + score) gets too cramped.
          "lg:grid lg:grid-cols-[5rem_1fr_auto_1fr_5rem] lg:items-center lg:gap-2 lg:px-2 lg:py-1.5",
        )}
      >
        {/* Header: match label + schedule + outcome (outcome only on mobile here). */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-xs font-semibold text-foreground">
              {matchLabel(match)}
            </span>
            {scheduled && <ScheduledStamp date={scheduled} />}
          </div>
          <div className="lg:hidden">
            <OutcomeCell
              outcome={outcome}
              myScore={myScore}
              oppScore={oppScore}
              played={played}
              cooperative={cooperative}
              sharedScore={cooperative ? blueScore || redScore : 0}
            />
          </div>
        </div>

        <AllianceCell
          alliance={blueAlliance}
          myTeamId={myTeamId}
          myTeamNumber={myTeamNumber}
          teamNames={teamNames}
          stats={stats}
          scoutedById={scoutedById}
          winner={blueWon}
          loser={redWon}
          cooperative={cooperative}
          hideScore={cooperative}
        />
        <span className="hidden text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 lg:block">
          {cooperative ? "&" : "vs"}
        </span>
        <AllianceCell
          alliance={redAlliance}
          myTeamId={myTeamId}
          myTeamNumber={myTeamNumber}
          teamNames={teamNames}
          stats={stats}
          scoutedById={scoutedById}
          winner={redWon}
          loser={blueWon}
          cooperative={cooperative}
          hideScore={cooperative}
        />
        <div className="hidden lg:block">
          <OutcomeCell
            outcome={outcome}
            myScore={myScore}
            oppScore={oppScore}
            played={played}
            cooperative={cooperative}
            sharedScore={cooperative ? blueScore || redScore : 0}
          />
        </div>
      </div>
    </li>
  );
}

function AllianceCell({
  alliance,
  myTeamId,
  myTeamNumber,
  teamNames,
  stats,
  scoutedById,
  winner = false,
  loser = false,
  cooperative = false,
  hideScore = false,
}: {
  alliance?: MatchAlliance;
  myTeamId: number;
  myTeamNumber: string;
  teamNames?: TeamInfoMap;
  stats: EventStatsMap;
  scoutedById?: Map<number, TeamRow>;
  winner?: boolean;
  loser?: boolean;
  /** VIQRC: skip W-L-T pill rendering and W/L tinting. */
  cooperative?: boolean;
  /** VIQRC: shared score is shown once in the outcome cell, not per side. */
  hideScore?: boolean;
}) {
  if (!alliance) {
    return <div className="px-3 py-2 text-xs text-muted-foreground/60">—</div>;
  }
  const color = alliance.color?.toLowerCase();
  const dotClass =
    color === "red"
      ? "bg-destructive"
      : color === "blue"
        ? "bg-blue-500"
        : "bg-muted-foreground";

  // Background tells the story: strong alliance color when that side won,
  // dimmed gray when it lost, light alliance tint while the match is pending.
  // For cooperative matches we never tint as winner/loser — the side keeps
  // the light alliance color so red/blue pairing is still visible.
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
  const teamList = alliance.teams ?? [];
  const displayScore = alliance.score ?? null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-2 min-w-0 rounded-md sm:px-3",
        bgClass,
        loser && "opacity-70",
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} />
      <ul className="flex flex-1 min-w-0 flex-col gap-1">
        {teamList.map((t) => {
          const info = teamNames?.get(t.team.id);
          const number = info?.number ?? t.team.name ?? "—";
          const name = info?.name ?? null;
          const isMe =
            t.team.id === myTeamId ||
            number.toUpperCase() === myTeamNumber.toUpperCase();
          const teamStat = pickStat(t.team.id, stats, scoutedById);

          return (
            <li
              key={t.team.id}
              className="flex min-w-0 flex-col gap-0.5 text-[11px]"
            >
              <div className="flex min-w-0 items-baseline gap-1.5">
                <span
                  className={cn(
                    "font-mono shrink-0",
                    isMe ? "font-bold text-primary" : "text-foreground",
                  )}
                >
                  {isMe ? "▸" : ""}
                  {number}
                </span>
                {name && (
                  <span
                    className={cn(
                      "truncate flex-1 min-w-0",
                      isMe
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground",
                    )}
                  >
                    {name}
                  </span>
                )}
              </div>
              <TeamStatPill stat={teamStat} cooperative={cooperative} />
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
          {displayScore ?? "—"}
        </span>
      )}
    </div>
  );
}

function TeamStatPill({
  stat,
  cooperative = false,
}: {
  stat: DisplayStat | null;
  cooperative?: boolean;
}) {
  if (!stat) {
    return (
      <span className="shrink-0 text-[10px] italic text-muted-foreground/50">
        no data
      </span>
    );
  }
  const isEvent = stat.source === "event";
  const rankLabel = isEvent
    ? "Teamwork rank in this division"
    : "Best teamwork rank from past events this season";

  return (
    <span
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 font-mono text-[10px]",
        isEvent ? "text-foreground" : "text-muted-foreground italic",
      )}
    >
      {stat.rank != null && (
        <span title={rankLabel}>
          <span className="text-muted-foreground">TW</span>
          <span className="ml-0.5">#{stat.rank}</span>
        </span>
      )}
      {!cooperative &&
        isEvent &&
        (stat.wins > 0 || stat.losses > 0 || stat.ties > 0) && (
          <span title="Wins-Losses-Ties at this event">
            {stat.wins}-{stat.losses}-{stat.ties}
          </span>
        )}
      {stat.skillsScore != null && (
        <span title="Skills score (prog + driver)">
          <span className="text-muted-foreground">SK</span>
          <span className="ml-0.5">{stat.skillsScore}</span>
        </span>
      )}
    </span>
  );
}

function OutcomeCell({
  outcome,
  myScore,
  oppScore,
  played,
  cooperative = false,
  sharedScore = 0,
}: {
  outcome: "W" | "L" | "T" | null;
  myScore: number;
  oppScore: number;
  played: boolean;
  /** VIQRC: skip W/L/Tie — show just the shared cooperative score. */
  cooperative?: boolean;
  sharedScore?: number;
}) {
  if (!played) {
    return (
      <span className="text-right text-[10px] uppercase tracking-wide text-muted-foreground/60">
        Upcoming
      </span>
    );
  }
  if (cooperative) {
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
        —
      </span>
    );
  }
  const label = outcome === "W" ? "Win" : outcome === "L" ? "Loss" : "Tie";
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

function isPlayed(match: Match): boolean {
  if (match.scored === true) return true;
  for (const a of match.alliances) {
    if ((a.score ?? 0) > 0) return true;
  }
  return false;
}

// VIQRC matches are cooperative: 2 teams share 1 score, no opposing alliance.
// In RobotEvents, VIQRC Mix & Match still returns red/blue alliances — but
// each alliance holds only 1 team and both alliances post the same shared
// score. V5RC/VURC/VAIRC always have ≥2 teams per alliance. Discriminate by
// team count rather than color presence.
function isCooperativeMatch(match: Match): boolean {
  if (match.alliances.length === 0) return false;
  if (match.alliances.length === 1) return true;
  return match.alliances.every((a) => (a.teams?.length ?? 0) <= 1);
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

function formatRelative(timestampMs: number): string {
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

function ScheduledStamp({ date }: { date: Date }) {
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return (
    <div className="flex flex-col text-[10px] leading-tight text-muted-foreground">
      <span className="flex items-center gap-1 whitespace-nowrap">
        <Calendar className="h-3 w-3 shrink-0" />
        {day}
      </span>
      <span className="pl-4 font-mono whitespace-nowrap">{time}</span>
    </div>
  );
}
