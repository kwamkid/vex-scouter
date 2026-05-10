import * as React from "react";
import { cn } from "@/lib/utils";
import type { Match } from "@/lib/robotevents/schemas";

export type TeamInfo = { number: string; name: string | null };
export type TeamInfoMap = Map<number, TeamInfo>;

/**
 * Per-team stats rendered under each cooperative (IQ) team cell.
 * Keep null-friendly so callers can pass partial data.
 */
export type RowTeamStat = {
  rank?: number | null;
  skillsRank?: number | null;
  skillsScore?: number | null;
  /** Avg cooperative match score for this team across this event. */
  avgMatchScore?: number | null;
};
export type RowTeamStatMap = Map<number, RowTeamStat>;

/**
 * VEX VIA-style single-row match display.
 *
 * Competitive (V5RC/VURC/VAIRC):  [label][red teams][R][B][blue teams]
 * Cooperative  (VIQRC):            [label][team1+name+rank][score+avg][team2+name+rank]
 *
 * Winner conveyed via score weight + alliance-tinted color (no W/L badge).
 * The user's team is rendered as a solid colored pill so it pops out of the
 * row on a glance.
 */
export function MatchVIARow({
  match,
  myTeamNumber,
  teamNames,
  teamStats,
  accent,
}: {
  match: Match;
  myTeamNumber: string;
  teamNames?: TeamInfoMap;
  /** Per-team rank/skill data; renders under each cooperative team cell. */
  teamStats?: RowTeamStatMap;
  /** "iq" | "v5" — controls the my-team highlight pill color. */
  accent?: "iq" | "v5";
}) {
  const cooperative = isCooperativeMatch(match);
  const scheduled = match.scheduled ? new Date(match.scheduled) : null;

  if (cooperative) {
    const teams = match.alliances.flatMap((a) => a.teams ?? []);
    const score = cooperativeScore(match);
    const played = score != null;
    return (
      <li className="border-b border-border/50 last:border-b-0">
        <div className="grid grid-cols-[15%_35%_15%_35%] items-center gap-1.5 px-2 py-2.5 sm:gap-2 sm:px-3 sm:py-3">
          <MatchLabelCell match={match} scheduled={scheduled} />
          <TeamStatColumn
            teams={teams[0] ? [teams[0]] : []}
            tone="cooperative"
            align="end"
            myTeamNumber={myTeamNumber}
            teamNames={teamNames}
            teamStats={teamStats}
            accent={accent}
          />
          <ScoreCell
            score={score ?? undefined}
            tone="cooperative"
            winner={played}
            played={played}
          />
          <TeamStatColumn
            teams={teams[1] ? [teams[1]] : []}
            tone="cooperative"
            align="start"
            myTeamNumber={myTeamNumber}
            teamNames={teamNames}
            teamStats={teamStats}
            accent={accent}
          />
        </div>
      </li>
    );
  }

  const redAlliance = match.alliances.find(
    (a) => a.color?.toLowerCase() === "red",
  );
  const blueAlliance = match.alliances.find(
    (a) => a.color?.toLowerCase() === "blue",
  );
  const redScore = redAlliance?.score ?? 0;
  const blueScore = blueAlliance?.score ?? 0;
  const played = isPlayed(match);
  const redWon = played && redScore > blueScore;
  const blueWon = played && blueScore > redScore;

  return (
    <li className="border-b border-border/50 last:border-b-0">
      <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto_auto_minmax(0,1fr)] items-center gap-1.5 px-2 py-2.5 sm:gap-2 sm:px-3 sm:py-3">
        <MatchLabelCell match={match} scheduled={scheduled} />
        <TeamStatColumn
          teams={redAlliance?.teams ?? []}
          tone="red"
          align="end"
          myTeamNumber={myTeamNumber}
          teamNames={teamNames}
          teamStats={teamStats}
          accent={accent}
        />
        <ScoreCell
          score={redAlliance?.score}
          tone="red"
          winner={redWon}
          played={played}
        />
        <ScoreCell
          score={blueAlliance?.score}
          tone="blue"
          winner={blueWon}
          played={played}
        />
        <TeamStatColumn
          teams={blueAlliance?.teams ?? []}
          tone="blue"
          align="start"
          myTeamNumber={myTeamNumber}
          teamNames={teamNames}
          teamStats={teamStats}
          accent={accent}
        />
      </div>
    </li>
  );
}

function MatchLabelCell({
  match,
  scheduled,
}: {
  match: Match;
  scheduled: Date | null;
}) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="font-mono text-sm font-bold text-foreground sm:text-base">
        {matchLabel(match)}
      </span>
      {scheduled && (
        <span className="mt-0.5 text-[10px] text-muted-foreground">
          {scheduled.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      )}
    </div>
  );
}

const TONE_TEXT = {
  red: "text-destructive",
  blue: "text-blue-600 dark:text-blue-400",
  cooperative: "text-foreground",
} as const;

const TONE_TEXT_DIM = {
  red: "text-destructive/50",
  blue: "text-blue-600/50 dark:text-blue-400/50",
  cooperative: "text-muted-foreground",
} as const;

type Tone = keyof typeof TONE_TEXT;

// Tone-tinted bordered box that holds a match score. Strong tone for the
// winner, dim/muted tone for the loser. The grid row's `items-center`
// vertically centers this within whatever height the alliance columns set.
const TONE_BOX_WIN = {
  red: "border-destructive/60 bg-destructive/10 text-destructive",
  blue: "border-blue-500/60 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  cooperative: "border-foreground/40 bg-muted/40 text-foreground",
} as const;

const TONE_BOX_DIM = {
  red: "border-destructive/25 bg-destructive/5 text-destructive/60",
  blue: "border-blue-500/25 bg-blue-500/5 text-blue-600/60 dark:text-blue-400/60",
  cooperative: "border-border bg-muted/30 text-muted-foreground",
} as const;

function ScoreCell({
  score,
  tone,
  winner,
  played,
}: {
  score: number | null | undefined;
  tone: Tone;
  winner: boolean;
  played: boolean;
}) {
  if (!played) {
    return (
      <div className="flex items-center justify-center self-center rounded-md border border-border/50 bg-muted/20 px-2 py-1 sm:px-2.5 sm:py-1.5">
        <span className="font-mono text-base text-muted-foreground/50 tabular-nums sm:text-lg">
          —
        </span>
      </div>
    );
  }
  const box = winner ? TONE_BOX_WIN[tone] : TONE_BOX_DIM[tone];
  return (
    <div
      className={cn(
        "flex items-center justify-center self-center rounded-md border px-2 py-1 sm:px-2.5 sm:py-1.5",
        box,
      )}
    >
      <span
        className={cn(
          "font-mono tabular-nums leading-none",
          winner ? "text-2xl font-bold sm:text-3xl" : "text-xl font-semibold sm:text-2xl",
        )}
      >
        {score ?? 0}
      </span>
    </div>
  );
}

/**
 * Renders a column of teams (1 for cooperative, 1-2 for V5 alliance). Each
 * team gets a stacked block: number badge → team name (line-clamp-2) →
 * TW rank · avg score → SK rank · skills score. Same layout for both IQ
 * and V5 so the rows feel consistent.
 */
function TeamStatColumn({
  teams,
  tone,
  align,
  myTeamNumber,
  teamNames,
  teamStats,
  accent,
}: {
  teams: { team: { id: number; name?: string | null } }[];
  tone: Tone;
  align: "start" | "end";
  myTeamNumber: string;
  teamNames?: TeamInfoMap;
  teamStats?: RowTeamStatMap;
  accent?: "iq" | "v5";
}) {
  if (!teams.length) {
    return <div className="text-xs text-muted-foreground/40">—</div>;
  }
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 leading-tight",
        align === "end" ? "items-end text-right" : "items-start text-left",
      )}
    >
      {teams.map((t) => (
        <TeamStatCell
          key={t.team.id}
          team={t}
          tone={tone}
          align={align}
          myTeamNumber={myTeamNumber}
          teamNames={teamNames}
          teamStats={teamStats}
          accent={accent}
        />
      ))}
    </div>
  );
}

function TeamStatCell({
  team,
  tone,
  align,
  myTeamNumber,
  teamNames,
  teamStats,
  accent,
}: {
  team: { team: { id: number; name?: string | null } };
  tone: Tone;
  align: "start" | "end";
  myTeamNumber: string;
  teamNames?: TeamInfoMap;
  teamStats?: RowTeamStatMap;
  accent?: "iq" | "v5";
}) {
  const info = teamNames?.get(team.team.id);
  const stat = teamStats?.get(team.team.id);
  const teamName = info?.name ?? null;
  const accentColor = accent === "iq" ? "text-[#006BB4]" : "text-brand-orange";
  // Hide per-team rank/skill lines for the user's own team — those numbers
  // already live in the "Your event stats" panel above the match list.
  const cellNumber = info?.number ?? team.team.name ?? "";
  const isMe = cellNumber.toUpperCase() === myTeamNumber.toUpperCase();
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col leading-tight",
        align === "end" ? "items-end text-right" : "items-start text-left",
      )}
    >
      <TeamNumber
        team={team}
        tone={tone}
        myTeamNumber={myTeamNumber}
        teamNames={teamNames}
        accent={accent}
      />
      {teamName && (
        <span className="mt-0.5 max-w-full text-[11px] leading-tight text-muted-foreground line-clamp-2">
          {teamName}
        </span>
      )}
      {!isMe && stat && (stat.rank != null || stat.avgMatchScore != null) && (
        <div className="mt-0.5 flex items-baseline gap-1 font-mono text-[10px]">
          <span className="text-muted-foreground">TW</span>
          {stat.rank != null ? (
            <span className={cn("font-semibold", accentColor)}>
              #{stat.rank}
            </span>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          )}
          <span className="text-muted-foreground/40">·</span>
          {stat.avgMatchScore != null ? (
            <span className="text-foreground">
              {Math.round(stat.avgMatchScore)}
            </span>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          )}
        </div>
      )}
      {!isMe && stat && (stat.skillsRank != null || stat.skillsScore != null) && (
        <div className="flex items-baseline gap-1 font-mono text-[10px]">
          <span className="text-muted-foreground">SK</span>
          {stat.skillsRank != null ? (
            <span className={cn("font-semibold", accentColor)}>
              #{stat.skillsRank}
            </span>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          )}
          <span className="text-muted-foreground/40">·</span>
          {stat.skillsScore != null ? (
            <span className="text-foreground">{stat.skillsScore}</span>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          )}
        </div>
      )}
    </div>
  );
}

function TeamNumber({
  team,
  tone,
  myTeamNumber,
  teamNames,
  accent,
}: {
  team: { team: { id: number; name?: string | null } };
  tone: Tone;
  myTeamNumber: string;
  teamNames?: TeamInfoMap;
  accent?: "iq" | "v5";
}) {
  const info = teamNames?.get(team.team.id);
  const number = info?.number ?? team.team.name ?? "—";
  const isMe = number.toUpperCase() === myTeamNumber.toUpperCase();
  // Solid pill on "us" so the row owner pops on a glance, regardless of
  // which alliance color it sits on. IQ uses VEX IQ blue; V5 uses brand red.
  const myPill =
    accent === "iq"
      ? "rounded-md bg-[#006BB4] px-1.5 py-0.5 font-bold text-white shadow-sm"
      : "rounded-md bg-primary px-1.5 py-0.5 font-bold text-primary-foreground shadow-sm";
  return (
    <span
      className={cn(
        "font-mono text-sm font-semibold tabular-nums sm:text-[15px]",
        isMe ? myPill : TONE_TEXT[tone],
      )}
    >
      {number}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers (shared between rows)
// ---------------------------------------------------------------------------

export function isCooperativeMatch(match: Match): boolean {
  if (match.alliances.length === 0) return false;
  if (match.alliances.length === 1) return true;
  return match.alliances.every((a) => (a.teams?.length ?? 0) <= 1);
}

export function cooperativeScore(match: Match): number | null {
  for (const a of match.alliances) {
    if (a.score != null) return a.score;
  }
  return null;
}

export function isPlayed(match: Match): boolean {
  if (match.scored === true) return true;
  for (const a of match.alliances) {
    if ((a.score ?? 0) > 0) return true;
  }
  return false;
}

export function matchLabel(m: Match): string {
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
  // Quals/Practice (rounds 1-2) drop the dash for VIA-style: Q20, P5.
  // Elims keep instance + matchnum separator: QF1-2, SF2-1.
  if (m.round <= 2) return `${prefix}${m.matchnum}`;
  const inst = m.instance ?? 1;
  return `${prefix}${inst}-${m.matchnum}`;
}
