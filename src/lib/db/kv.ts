import { createClient } from "@vercel/kv";
import type { TeamRow } from "@/types";

const kv = createClient({
  url: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? "",
  token:
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? "",
});

const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function key(teamId: number, seasonId: number): string {
  return `scout:${seasonId}:${teamId}`;
}

function allKey(seasonId: number): string {
  return `scout-index:${seasonId}`;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function kvGetCachedTeamRow(
  teamId: number,
  seasonId: number,
): Promise<TeamRow | null> {
  try {
    const row = await kv.get<TeamRow>(key(teamId, seasonId));
    return row ?? null;
  } catch {
    return null;
  }
}

export async function kvGetCachedTeamRows(
  teamIds: number[],
  seasonId: number,
): Promise<Map<number, TeamRow>> {
  const result = new Map<number, TeamRow>();
  if (!teamIds.length) return result;

  try {
    const keys = teamIds.map((id) => key(id, seasonId));
    const values = await kv.mget<(TeamRow | null)[]>(...keys);
    teamIds.forEach((id, i) => {
      const v = values[i];
      if (v) result.set(id, v);
    });
  } catch {
    // fallback: fetch one by one
    for (const id of teamIds) {
      const row = await kvGetCachedTeamRow(id, seasonId);
      if (row) result.set(id, row);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function kvSetCachedTeamRow(
  teamId: number,
  seasonId: number,
  _teamNumber: string,
  row: TeamRow,
): Promise<void> {
  try {
    await kv.set(key(teamId, seasonId), row, { ex: TTL_SECONDS });
    // Track team id in season index for getAllCachedRows.
    await kv.sadd(allKey(seasonId), teamId);
    await kv.expire(allKey(seasonId), TTL_SECONDS);
  } catch {
    // ignore write failures
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function kvInvalidateTeamCache(
  teamId: number,
  seasonId: number,
): Promise<void> {
  try {
    await kv.del(key(teamId, seasonId));
    await kv.srem(allKey(seasonId), teamId);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Get all rows for a season (for rankings page)
// ---------------------------------------------------------------------------

export async function kvGetAllCachedRows(
  seasonId: number,
  grade?: string | null,
): Promise<TeamRow[]> {
  try {
    const teamIds = await kv.smembers<number[]>(allKey(seasonId));
    if (!teamIds || !teamIds.length) return [];

    const keys = teamIds.map((id) => key(id, seasonId));
    const values = await kv.mget<(TeamRow | null)[]>(...keys);

    const rows: TeamRow[] = [];
    for (const v of values) {
      if (!v) continue;
      if (grade && v.grade && v.grade !== grade) continue;
      rows.push(v);
    }
    return rows;
  } catch {
    return [];
  }
}
