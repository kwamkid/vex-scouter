import { reGetAllPaged } from "./client";
import { AwardSchema, type Award } from "./schemas";

export async function getTeamAwards(
  teamId: number,
  seasonId: number,
): Promise<Award[]> {
  return reGetAllPaged(
    `/teams/${teamId}/awards`,
    { "season[]": seasonId },
    AwardSchema,
    { revalidate: 60 * 60, tags: [`team:${teamId}`, `team:${teamId}:awards`] },
    5,
  );
}
