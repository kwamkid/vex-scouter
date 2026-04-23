import { lookupTeamsByNumbers } from "@/lib/robotevents/teams";
import { getTeamAwards } from "@/lib/robotevents/awards";
import { getTeamRankings } from "@/lib/robotevents/rankings";
import { getSeasonSkillsForTeams, getWorldSkillsRanks } from "@/lib/robotevents/skills";
import { findCurrentSeason } from "@/lib/robotevents/season";
import { mapWithConcurrency } from "@/lib/robotevents/pool";
import { aggregateTeamRow } from "./aggregate";
import { getCachedTeamRows, setCachedTeamRow } from "@/lib/db/adapter";
import type { TeamRow } from "@/types";
import type { Team } from "@/lib/robotevents/schemas";
import type { GradeLevel } from "@/lib/robotevents/programs";

export type BuildRowsResult = {
  seasonId: number;
  seasonName: string;
  rows: TeamRow[];
  partial: boolean;
  errorMessage: string | null;
};

const PER_TEAM_CONCURRENCY = 1;

export async function buildTeamRows(
  numbers: string[],
  opts: {
    programId: number;
    grade?: GradeLevel | null;
    season?: { id: number; name: string } | null;
  },
): Promise<BuildRowsResult> {
  const season = opts.season ?? (await findCurrentSeason(opts.programId));
  const teams = await lookupTeamsByNumbers(numbers, opts.programId);
  return buildRowsFromTeams(numbers, teams, season, opts.programId);
}

export async function buildTeamRowsFromTeamList(
  teams: Team[],
  opts: {
    programId: number;
    season?: { id: number; name: string } | null;
  },
): Promise<BuildRowsResult> {
  const season = opts.season ?? (await findCurrentSeason(opts.programId));
  const numbers = teams.map((t) => t.number.toUpperCase());
  return buildRowsFromTeams(numbers, teams, season, opts.programId);
}

async function buildRowsFromTeams(
  numbers: string[],
  teams: Team[],
  season: { id: number; name: string },
  programId: number,
): Promise<BuildRowsResult> {
  const seasonId = season.id;
  const byNumber = new Map(teams.map((t) => [t.number.toUpperCase(), t]));
  const teamIds = teams.map((t) => t.id);

  let partial = false;
  let errorMessage: string | null = null;

  const reportErr = (kind: string) => (e: unknown) => {
    partial = true;
    if (!errorMessage) errorMessage = `${kind}: ${(e as Error).message}`;
    return [] as never;
  };

  const [awardsByTeam, rankingsByTeam, teamSkills, worldMap] = await Promise.all([
    mapWithConcurrency(teamIds, PER_TEAM_CONCURRENCY, (id) =>
      getTeamAwards(id, seasonId).catch(reportErr("awards")),
    ),
    mapWithConcurrency(teamIds, PER_TEAM_CONCURRENCY, (id) =>
      getTeamRankings(id, seasonId).catch(reportErr("rankings")),
    ),
    getSeasonSkillsForTeams(seasonId, teamIds).catch((e) => {
      partial = true;
      errorMessage = errorMessage ?? `skills: ${(e as Error).message}`;
      return [];
    }),
    getWorldSkillsRanks(seasonId, teamIds).catch((e) => {
      partial = true;
      errorMessage = errorMessage ?? `world skills: ${(e as Error).message}`;
      return new Map<number, number>();
    }),
  ]);

  const skillsByTeam = new Map<number, typeof teamSkills>();
  for (const s of teamSkills) {
    const arr = skillsByTeam.get(s.team.id) ?? [];
    arr.push(s);
    skillsByTeam.set(s.team.id, arr);
  }

  const awardsMap = new Map<number, (typeof awardsByTeam)[number]>();
  const rankingsMap = new Map<number, (typeof rankingsByTeam)[number]>();
  teamIds.forEach((id, i) => {
    awardsMap.set(id, awardsByTeam[i]);
    rankingsMap.set(id, rankingsByTeam[i]);
  });

  // Check cache for each team first, only aggregate uncached ones.
  const cachedRows = await getCachedTeamRows(teamIds, seasonId);
  const rows: TeamRow[] = [];
  for (const num of numbers) {
    const team = byNumber.get(num) ?? null;
    if (team && cachedRows.has(team.id)) {
      rows.push(cachedRows.get(team.id)!);
      continue;
    }
    const row = aggregateTeamRow({
      number: num,
      team,
      programId,
      awards: team ? (awardsMap.get(team.id) ?? []) : [],
      events: [],
      rankings: team ? (rankingsMap.get(team.id) ?? []) : [],
      skills: team ? (skillsByTeam.get(team.id) ?? []) : [],
      worldSkillsMap: worldMap,
    });
    rows.push(row);
    if (team) await setCachedTeamRow(team.id, seasonId, team.number, row);
  }

  return {
    seasonId,
    seasonName: season.name,
    rows,
    partial,
    errorMessage,
  };
}
