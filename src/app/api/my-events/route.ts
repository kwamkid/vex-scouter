import { NextResponse } from "next/server";
import { lookupTeamsByNumbers } from "@/lib/robotevents/teams";
import { getTeamEvents } from "@/lib/robotevents/events";
import { findCurrentSeason } from "@/lib/robotevents/season";
import { findProgram } from "@/lib/robotevents/programs";
import { reGetAllPaged } from "@/lib/robotevents/client";
import { SeasonSchema } from "@/lib/robotevents/schemas";

async function resolveSeason(
  programId: number,
  seasonId: number,
): Promise<{ id: number; name: string }> {
  const seasons = await reGetAllPaged(
    "/seasons",
    { "program[]": programId },
    SeasonSchema,
    { revalidate: 60 * 60 * 24, tags: ["seasons", `seasons:${programId}`] },
    3,
  );
  const match = seasons.find((s) => s.id === seasonId);
  if (match) return { id: match.id, name: match.name };
  return findCurrentSeason(programId);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const teamNumber = url.searchParams.get("team")?.trim().toUpperCase();
  const programCode = (url.searchParams.get("program") ?? "V5RC").toUpperCase();
  const seasonParam = url.searchParams.get("season");
  const seasonOverride = seasonParam ? Number(seasonParam) : null;
  if (!teamNumber) {
    return NextResponse.json({ error: "missing team" }, { status: 400 });
  }
  const programDef = findProgram(programCode) ?? findProgram("V5RC")!;

  try {
    const [season, teams] = await Promise.all([
      seasonOverride && Number.isFinite(seasonOverride)
        ? resolveSeason(programDef.id, seasonOverride)
        : findCurrentSeason(programDef.id),
      lookupTeamsByNumbers([teamNumber], programDef.id),
    ]);
    const team = teams[0];
    if (!team) {
      return NextResponse.json(
        { error: `Team ${teamNumber} not found in ${programDef.code}` },
        { status: 404 },
      );
    }

    const events = await getTeamEvents(team.id, season.id);
    // Return every event for the season — the UI splits them into
    // past / ongoing / upcoming buckets. Sort by start ascending so each
    // bucket arrives in chronological order.
    const sorted = events.sort((a, b) => {
      const aT = a.start ? new Date(a.start).getTime() : 0;
      const bT = b.start ? new Date(b.start).getTime() : 0;
      return aT - bT;
    });

    return NextResponse.json({
      team,
      season,
      events: sorted,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
