import { reGetAllPaged } from "./client";
import { mapWithConcurrency } from "./pool";
import { SkillSchema, type Skill } from "./schemas";

const CONCURRENCY = 1;

// Fetch all skills runs for each team in a season. RobotEvents v2 does not
// expose a season-wide skills endpoint, so we query per team.
export async function getTeamSkills(
  teamId: number,
  seasonId: number,
): Promise<Skill[]> {
  return reGetAllPaged(
    `/teams/${teamId}/skills`,
    { "season[]": seasonId },
    SkillSchema,
    {
      revalidate: 10 * 60,
      tags: [`team:${teamId}`, `team:${teamId}:skills`],
    },
    5,
  );
}

export async function getSeasonSkillsForTeams(
  seasonId: number,
  teamIds: number[],
): Promise<Skill[]> {
  if (!teamIds.length) return [];
  const results = await mapWithConcurrency(teamIds, CONCURRENCY, (id) =>
    getTeamSkills(id, seasonId).catch(() => [] as Skill[]),
  );
  return results.flat();
}

// Best skills "rank" we can compute per team: the lowest rank observed across
// the team's own skills runs this season. This is an event-local rank (not a
// world rank); true world ranking is not exposed by the RobotEvents v2 API.
export async function getWorldSkillsRanks(
  _seasonId: number,
  _teamIds: number[],
): Promise<Map<number, number>> {
  return new Map();
}
