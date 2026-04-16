import { NextResponse } from "next/server";
import { getTeamEvents } from "@/lib/robotevents/events";
import { findCurrentSeason } from "@/lib/robotevents/season";
import { findProgram } from "@/lib/robotevents/programs";

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
  const programDef = findProgram(programCode) ?? findProgram("V5RC")!;

  try {
    const season = await findCurrentSeason(programDef.id);
    const events = await getTeamEvents(teamId, season.id);
    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
