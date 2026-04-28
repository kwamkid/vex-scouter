import { NextResponse } from "next/server";
import { getEventTeams, getTeamMatchesAtEvent } from "@/lib/robotevents/events";
import { lookupTeamsByNumbers } from "@/lib/robotevents/teams";
import { findProgram } from "@/lib/robotevents/programs";

// Matches played by a specific team at a specific event. The client passes
// either a teamId directly (preferred, no RE lookup) or a team number + program
// (we resolve to an id).
//
// Also returns `teamInfo`: { id → { number, name } } for every team registered
// at the event so the UI can display partner/opponent names without a second
// roundtrip. `getEventTeams` is already cached, so this is cheap.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ error: "invalid event id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const teamIdParam = url.searchParams.get("teamId");
  const teamNumber = url.searchParams.get("team")?.trim().toUpperCase();
  const programCode = (
    url.searchParams.get("program") ?? "V5RC"
  ).toUpperCase();

  try {
    let teamId: number | null = null;

    if (teamIdParam && Number.isFinite(Number(teamIdParam))) {
      teamId = Number(teamIdParam);
    } else if (teamNumber) {
      const programDef = findProgram(programCode) ?? findProgram("V5RC")!;
      const teams = await lookupTeamsByNumbers([teamNumber], programDef.id);
      teamId = teams[0]?.id ?? null;
    }

    if (teamId == null) {
      return NextResponse.json(
        { error: "missing teamId or team number" },
        { status: 400 },
      );
    }

    const [matches, eventTeams] = await Promise.all([
      getTeamMatchesAtEvent(eventId, teamId),
      getEventTeams(eventId).catch(() => []),
    ]);
    const teamInfo: Record<string, { number: string; name: string | null }> = {};
    for (const t of eventTeams) {
      teamInfo[String(t.id)] = { number: t.number, name: t.team_name ?? null };
    }
    return NextResponse.json({ teamId, matches, teamInfo });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
