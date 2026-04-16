import { reGetAllPaged } from "./client";
import { mapWithConcurrency } from "./pool";
import { TeamSchema, type Team } from "./schemas";

const CHUNK_SIZE = 20;
const CONCURRENCY = 1;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function lookupTeamsByNumbers(
  numbers: string[],
  programId: number,
): Promise<Team[]> {
  if (!numbers.length) return [];
  const chunks = chunk(numbers, CHUNK_SIZE);

  const results = await mapWithConcurrency(chunks, CONCURRENCY, (group) =>
    reGetAllPaged(
      "/teams",
      {
        "number[]": group,
        "program[]": programId,
      },
      TeamSchema,
      {
        revalidate: 60 * 60 * 24,
        tags: ["teams", `teams:program:${programId}`],
      },
      5,
    ).catch(() => [] as Team[]),
  );

  const seen = new Set<number>();
  const merged: Team[] = [];
  for (const list of results) {
    for (const t of list) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      merged.push(t);
    }
  }
  return merged;
}
