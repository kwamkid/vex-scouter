import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { TeamRow } from "@/types";

const CACHE_DIR = path.join(process.cwd(), "data", "scout-cache");
const TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

function filePath(seasonId: number, teamId: number): string {
  return path.join(CACHE_DIR, String(seasonId), `${teamId}.json`);
}

type CacheEntry = {
  row: TeamRow;
  cachedAt: number; // epoch ms
};

export async function getCachedScout(
  seasonId: number,
  teamId: number,
): Promise<TeamRow | null> {
  try {
    const raw = await readFile(filePath(seasonId, teamId), "utf-8");
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > TTL_MS) return null;
    return entry.row;
  } catch {
    return null;
  }
}

export async function setCachedScout(
  seasonId: number,
  teamId: number,
  row: TeamRow,
): Promise<void> {
  const fp = filePath(seasonId, teamId);
  const dir = path.dirname(fp);
  await mkdir(dir, { recursive: true });
  const entry: CacheEntry = { row, cachedAt: Date.now() };
  await writeFile(fp, JSON.stringify(entry), "utf-8");
}
