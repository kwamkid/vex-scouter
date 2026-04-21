// Unified cache adapter.
// - Local dev (no KV_REST_API_URL) → SQLite
// - Vercel production (KV_REST_API_URL set) → Vercel KV (Upstash Redis)

import type { TeamRow } from "@/types";

const isVercelKV = Boolean(
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
);

// Lazy imports to avoid loading both drivers.
async function sqlite() {
  const mod = await import("./index");
  return mod;
}

async function kvMod() {
  const mod = await import("./kv");
  return mod;
}

export async function getCachedTeamRow(
  teamId: number,
  seasonId: number,
): Promise<TeamRow | null> {
  if (isVercelKV) {
    const { kvGetCachedTeamRow } = await kvMod();
    return kvGetCachedTeamRow(teamId, seasonId);
  }
  const { getCachedTeamRow: sqliteGet } = await sqlite();
  return sqliteGet(teamId, seasonId);
}

export async function getCachedTeamRows(
  teamIds: number[],
  seasonId: number,
): Promise<Map<number, TeamRow>> {
  if (isVercelKV) {
    const { kvGetCachedTeamRows } = await kvMod();
    return kvGetCachedTeamRows(teamIds, seasonId);
  }
  const { getCachedTeamRows: sqliteGetMany } = await sqlite();
  return sqliteGetMany(teamIds, seasonId);
}

export async function setCachedTeamRow(
  teamId: number,
  seasonId: number,
  teamNumber: string,
  row: TeamRow,
): Promise<void> {
  if (isVercelKV) {
    const { kvSetCachedTeamRow } = await kvMod();
    return kvSetCachedTeamRow(teamId, seasonId, teamNumber, row);
  }
  const { setCachedTeamRow: sqliteSet } = await sqlite();
  sqliteSet(teamId, seasonId, teamNumber, row);
}

export async function invalidateTeamCache(
  teamId: number,
  seasonId: number,
): Promise<void> {
  if (isVercelKV) {
    const { kvInvalidateTeamCache } = await kvMod();
    return kvInvalidateTeamCache(teamId, seasonId);
  }
  const { invalidateTeamCache: sqliteInvalidate } = await sqlite();
  sqliteInvalidate(teamId, seasonId);
}

export async function getAllCachedRows(
  seasonId: number,
  grade?: string | null,
): Promise<TeamRow[]> {
  if (isVercelKV) {
    const { kvGetAllCachedRows } = await kvMod();
    return kvGetAllCachedRows(seasonId, grade);
  }
  const { getAllCachedRows: sqliteGetAll } = await sqlite();
  return sqliteGetAll(seasonId, grade);
}
