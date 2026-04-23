import { NextResponse } from "next/server";
import { getTeamMatchesAtEvent } from "@/lib/robotevents/events";
import { lookupTeamsByNumbers } from "@/lib/robotevents/teams";
import { findProgram } from "@/lib/robotevents/programs";

// Matches played by a specific team at a specific event. The client passes
// either a teamId directly (preferred, no RE lookup) or a team number + program
// (we resolve to an id).
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

    const matches = await getTeamMatchesAtEvent(eventId, teamId);
    return NextResponse.json({ teamId, matches });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
