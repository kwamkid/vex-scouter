import { reGetAllPaged } from "./client";
import { RankingSchema, type Ranking } from "./schemas";

export async function getTeamRankings(
  teamId: number,
  seasonId: number,
): Promise<Ranking[]> {
  return reGetAllPaged(
    `/teams/${teamId}/rankings`,
    { "season[]": seasonId },
    RankingSchema,
    { revalidate: 5 * 60, tags: [`team:${teamId}`, `team:${teamId}:rankings`] },
    5,
  );
}
