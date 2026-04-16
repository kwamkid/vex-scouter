import type { TeamRow } from "@/types";

export type SortDir = "asc" | "desc";
export type SortKey =
  | "skillsWorldRank"
  | "skillsScore"
  | "awardCount"
  | "awardTier"
  | "eventCount"
  | "bestEventRank";

function nullLast<T>(
  a: T | null | undefined,
  b: T | null | undefined,
  dir: SortDir,
): number {
  const aNil = a === null || a === undefined;
  const bNil = b === null || b === undefined;
  if (aNil && bNil) return 0;
  if (aNil) return 1;
  if (bNil) return -1;
  if (a === b) return 0;
  return dir === "asc" ? ((a as T) < (b as T) ? -1 : 1) : (a as T) < (b as T) ? 1 : -1;
}

export function sortRows(
  rows: TeamRow[],
  key: SortKey,
  dir: SortDir,
): TeamRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (a.notFound && !b.notFound) return 1;
    if (!a.notFound && b.notFound) return -1;
    return nullLast(a[key] as number | null, b[key] as number | null, dir);
  });
  return copy;
}

export function defaultSort(rows: TeamRow[]): TeamRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (a.notFound && !b.notFound) return 1;
    if (!a.notFound && b.notFound) return -1;
    // skillsWorldRank asc, awardTier asc (but 0 = no award → push last),
    // skillsScore desc
    const ar = a.skillsWorldRank ?? Number.POSITIVE_INFINITY;
    const br = b.skillsWorldRank ?? Number.POSITIVE_INFINITY;
    if (ar !== br) return ar - br;
    const at = a.awardTier === 0 ? 99 : a.awardTier;
    const bt = b.awardTier === 0 ? 99 : b.awardTier;
    if (at !== bt) return at - bt;
    const as = a.skillsScore ?? -1;
    const bs = b.skillsScore ?? -1;
    return bs - as;
  });
  return copy;
}
