import { reGetAllPaged } from "./client";
import { SeasonSchema } from "./schemas";

export const V5RC_PROGRAM_ID = 1;

// Pick the most relevant season for scouting right now:
//   1. If a season is currently active (today within start..end), use it.
//   2. Otherwise, prefer the most recent season that has already *started*
//      (start <= today). This keeps us on the just-finished season during
//      off-season months instead of jumping to a future season with no data.
//   3. Only if every known season is still in the future, fall back to the
//      earliest upcoming one.
export async function findCurrentSeason(
  programId: number,
): Promise<{ id: number; name: string }> {
  const seasons = await reGetAllPaged(
    "/seasons",
    { "program[]": programId },
    SeasonSchema,
    { revalidate: 60 * 60 * 24, tags: ["seasons", `seasons:${programId}`] },
    3,
  );

  if (!seasons.length) {
    throw new Error(`No seasons returned for program ${programId}`);
  }

  const now = Date.now();

  const active = seasons.find((s) => {
    const start = s.start ? new Date(s.start).getTime() : 0;
    const end = s.end ? new Date(s.end).getTime() : Infinity;
    return now >= start && now <= end;
  });
  if (active) return { id: active.id, name: active.name };

  const started = seasons
    .filter((s) => {
      const start = s.start ? new Date(s.start).getTime() : 0;
      return start <= now;
    })
    .sort((a, b) => {
      const aStart = a.start ? new Date(a.start).getTime() : 0;
      const bStart = b.start ? new Date(b.start).getTime() : 0;
      return bStart - aStart;
    });
  if (started.length) return { id: started[0].id, name: started[0].name };

  const upcoming = [...seasons].sort((a, b) => {
    const aStart = a.start ? new Date(a.start).getTime() : 0;
    const bStart = b.start ? new Date(b.start).getTime() : 0;
    return aStart - bStart;
  });
  return { id: upcoming[0].id, name: upcoming[0].name };
}

export async function findCurrentV5RCSeason() {
  return findCurrentSeason(V5RC_PROGRAM_ID);
}
