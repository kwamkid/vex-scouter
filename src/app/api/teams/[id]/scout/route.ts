import { NextResponse } from "next/server";
import { getTeamAwards } from "@/lib/robotevents/awards";
import { getTeamRankings } from "@/lib/robotevents/rankings";
import { getTeamSkills } from "@/lib/robotevents/skills";
import { findCurrentSeason } from "@/lib/robotevents/season";
import { findProgram } from "@/lib/robotevents/programs";
import { reGetAllPaged } from "@/lib/robotevents/client";
import { SeasonSchema, TeamSchema } from "@/lib/robotevents/schemas";
import { aggregateTeamRow } from "@/lib/ranking/aggregate";
import {
  getCachedTeamRow,
  setCachedTeamRow,
  invalidateTeamCache,
} from "@/lib/db";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const teamId = Number(id);
  if (!Number.isFinite(teamId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const programCode = (url.searchParams.get("program") ?? "V5RC").toUpperCase();
  const seasonParam = url.searchParams.get("season");
  const seasonOverride = seasonParam ? Number(seasonParam) : null;
  const forceRefresh = url.searchParams.get("refresh") === "1";
  const programDef = findProgram(programCode) ?? findProgram("V5RC")!;

  try {
    const season =
      seasonOverride && Number.isFinite(seasonOverride)
        ? await resolveSeason(programDef.id, seasonOverride)
        : await findCurrentSeason(programDef.id);

    // Force refresh: invalidate cache first.
    if (forceRefresh) {
      invalidateTeamCache(teamId, season.id);
    }

    // Check DB cache.
    if (!forceRefresh) {
      const cached = getCachedTeamRow(teamId, season.id);
      if (cached) {
        return NextResponse.json({ row: cached, season, cached: true });
      }
    }

    const teamJson = await reGetAllPaged(
      "/teams",
      { "id[]": teamId },
      TeamSchema,
      { revalidate: 60 * 60 * 24, tags: [`team:${teamId}`] },
      1,
    );
    const team = teamJson[0];
    if (!team) {
      return NextResponse.json({ error: "team not found" }, { status: 404 });
    }

    const [awards, rankings, skills] = await Promise.all([
      getTeamAwards(teamId, season.id).catch(() => []),
      getTeamRankings(teamId, season.id).catch(() => []),
      getTeamSkills(teamId, season.id).catch(() => []),
    ]);

    const row = aggregateTeamRow({
      number: team.number.toUpperCase(),
      team,
      awards,
      events: [],
      rankings,
      skills,
      worldSkillsMap: new Map(),
    });

    // Save to DB.
    setCachedTeamRow(teamId, season.id, team.number, row);

    return NextResponse.json({ row, season, cached: false });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}

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
