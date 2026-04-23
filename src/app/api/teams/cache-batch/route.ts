import { NextResponse } from "next/server";
import { getCachedTeamRows } from "@/lib/db/adapter";
import type { TeamRow } from "@/types";

// Batch cache probe: given a list of team IDs, return any rows already cached
// for (teamId, seasonId) under the given programId. Lets the UI pre-populate
// fully-scouted rows on mount without hitting the RobotEvents API.
//
// POST body: { ids: number[], seasonId: number, programId: number }
// Response: { rows: TeamRow[] }
export async function POST(req: Request) {
  let body: { ids?: unknown; seasonId?: unknown; programId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    : [];
  const seasonId = Number(body.seasonId);
  const programId = Number(body.programId);

  if (!Number.isFinite(seasonId) || !Number.isFinite(programId)) {
    return NextResponse.json(
      { error: "seasonId and programId are required numbers" },
      { status: 400 },
    );
  }
  if (ids.length === 0) {
    return NextResponse.json({ rows: [] });
  }

  const cached = await getCachedTeamRows(ids, seasonId);
  const rows: TeamRow[] = [];
  for (const row of cached.values()) {
    if (row.programId !== programId) continue;
    rows.push(row);
  }
  return NextResponse.json({ rows });
}
