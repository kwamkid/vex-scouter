import Database from "better-sqlite3";
import path from "path";
import { mkdirSync } from "fs";
import type { TeamRow } from "@/types";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "vex-scout.db");
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Ensure data directory exists.
mkdirSync(DB_DIR, { recursive: true });

// Singleton connection (reused across requests in the same process).
let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("busy_timeout = 3000");
    migrate(_db);
  }
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams_cache (
      team_id    INTEGER NOT NULL,
      season_id  INTEGER NOT NULL,
      team_number TEXT NOT NULL,
      row_json   TEXT NOT NULL,
      cached_at  INTEGER NOT NULL,
      PRIMARY KEY (team_id, season_id)
    );
    CREATE INDEX IF NOT EXISTS idx_teams_cache_season
      ON teams_cache (season_id);
    CREATE INDEX IF NOT EXISTS idx_teams_cache_number
      ON teams_cache (team_number, season_id);
  `);
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export function getCachedTeamRow(
  teamId: number,
  seasonId: number,
): TeamRow | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT row_json, cached_at FROM teams_cache WHERE team_id = ? AND season_id = ?",
    )
    .get(teamId, seasonId) as
    | { row_json: string; cached_at: number }
    | undefined;

  if (!row) return null;
  if (Date.now() - row.cached_at > TTL_MS) return null;
  try {
    return JSON.parse(row.row_json) as TeamRow;
  } catch {
    return null;
  }
}

export function getCachedTeamRows(
  teamIds: number[],
  seasonId: number,
): Map<number, TeamRow> {
  const db = getDb();
  const result = new Map<number, TeamRow>();
  if (!teamIds.length) return result;

  const stmt = db.prepare(
    "SELECT team_id, row_json, cached_at FROM teams_cache WHERE team_id = ? AND season_id = ?",
  );
  const now = Date.now();

  for (const id of teamIds) {
    const row = stmt.get(id, seasonId) as
      | { team_id: number; row_json: string; cached_at: number }
      | undefined;
    if (!row) continue;
    if (now - row.cached_at > TTL_MS) continue;
    try {
      result.set(id, JSON.parse(row.row_json) as TeamRow);
    } catch {
      // skip malformed
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export function setCachedTeamRow(
  teamId: number,
  seasonId: number,
  teamNumber: string,
  row: TeamRow,
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO teams_cache (team_id, season_id, team_number, row_json, cached_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (team_id, season_id)
     DO UPDATE SET team_number = excluded.team_number,
                   row_json = excluded.row_json,
                   cached_at = excluded.cached_at`,
  ).run(teamId, seasonId, teamNumber.toUpperCase(), JSON.stringify(row), Date.now());
}

// ---------------------------------------------------------------------------
// Delete / Refresh
// ---------------------------------------------------------------------------

export function invalidateTeamCache(
  teamId: number,
  seasonId: number,
): void {
  const db = getDb();
  db.prepare(
    "DELETE FROM teams_cache WHERE team_id = ? AND season_id = ?",
  ).run(teamId, seasonId);
}

export function invalidateSeasonCache(seasonId: number): void {
  const db = getDb();
  db.prepare("DELETE FROM teams_cache WHERE season_id = ?").run(seasonId);
}

// ---------------------------------------------------------------------------
// Stats (for debug)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Rankings: get all cached rows for a season, optionally filtered by grade.
// ---------------------------------------------------------------------------

export function getAllCachedRows(
  seasonId: number,
  grade?: string | null,
): TeamRow[] {
  const db = getDb();
  const now = Date.now();
  const cutoff = now - TTL_MS;

  const rows = db
    .prepare(
      "SELECT row_json FROM teams_cache WHERE season_id = ? AND cached_at > ?",
    )
    .all(seasonId, cutoff) as { row_json: string }[];

  const parsed: TeamRow[] = [];
  for (const r of rows) {
    try {
      const row = JSON.parse(r.row_json) as TeamRow;
      if (grade && row.grade && row.grade !== grade) continue;
      parsed.push(row);
    } catch {
      // skip malformed
    }
  }
  return parsed;
}

// Get a single team row by team number + season.
export function getCachedTeamByNumber(
  teamNumber: string,
  seasonId: number,
): TeamRow | null {
  const db = getDb();
  const cutoff = Date.now() - TTL_MS;
  const row = db
    .prepare(
      "SELECT row_json FROM teams_cache WHERE team_number = ? AND season_id = ? AND cached_at > ?",
    )
    .get(teamNumber.toUpperCase(), seasonId, cutoff) as
    | { row_json: string }
    | undefined;

  if (!row) return null;
  try {
    return JSON.parse(row.row_json) as TeamRow;
  } catch {
    return null;
  }
}

export function cacheStats(): {
  total: number;
  expired: number;
  fresh: number;
} {
  const db = getDb();
  const now = Date.now();
  const cutoff = now - TTL_MS;
  const total = (
    db.prepare("SELECT COUNT(*) as c FROM teams_cache").get() as { c: number }
  ).c;
  const fresh = (
    db
      .prepare("SELECT COUNT(*) as c FROM teams_cache WHERE cached_at > ?")
      .get(cutoff) as { c: number }
  ).c;
  return { total, expired: total - fresh, fresh };
}
