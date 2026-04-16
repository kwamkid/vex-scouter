import { NextResponse } from "next/server";
import { lookupTeamsByNumbers } from "@/lib/robotevents/teams";
import { getTeamAwards } from "@/lib/robotevents/awards";
import { getTeamEvents } from "@/lib/robotevents/events";
import { getTeamRankings } from "@/lib/robotevents/rankings";
import { getTeamSkills } from "@/lib/robotevents/skills";
import { findCurrentSeason } from "@/lib/robotevents/season";
import { findProgram } from "@/lib/robotevents/programs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const teamNumber = url.searchParams.get("team")?.trim().toUpperCase();
  const programCode = (url.searchParams.get("program") ?? "V5RC").toUpperCase();
  const seasonParam = url.searchParams.get("season");
  if (!teamNumber) {
    return NextResponse.json({ error: "missing team" }, { status: 400 });
  }
  const programDef = findProgram(programCode) ?? findProgram("V5RC")!;

  try {
    const season = seasonParam
      ? { id: Number(seasonParam), name: `Season ${seasonParam}` }
      : await findCurrentSeason(programDef.id);

    const teams = await lookupTeamsByNumbers([teamNumber], programDef.id);
    const team = teams[0];
    if (!team) {
      return NextResponse.json(
        { error: `Team ${teamNumber} not found in ${programDef.code}` },
        { status: 404 },
      );
    }

    const [awards, events, rankings, skills] = await Promise.all([
      getTeamAwards(team.id, season.id).catch(() => []),
      getTeamEvents(team.id, season.id).catch(() => []),
      getTeamRankings(team.id, season.id).catch(() => []),
      getTeamSkills(team.id, season.id).catch(() => []),
    ]);

    // Group awards by event.
    const awardsByEvent = new Map<number, typeof awards>();
    for (const a of awards) {
      if (!a.event?.id) continue;
      const arr = awardsByEvent.get(a.event.id) ?? [];
      arr.push(a);
      awardsByEvent.set(a.event.id, arr);
    }

    // Build per-event summary.
    const eventSummaries = events
      .sort((a, b) => {
        const aT = a.start ? new Date(a.start).getTime() : 0;
        const bT = b.start ? new Date(b.start).getTime() : 0;
        return bT - aT;
      })
      .map((e) => {
        const rank = rankings.find((r) => r.event?.id === e.id);
        const eventSkills = skills.filter((s) => s.event?.id === e.id);
        const bestProg = eventSkills
          .filter((s) => String(s.type).toLowerCase() === "programming")
          .reduce((m, s) => Math.max(m, s.score), 0);
        const bestDriver = eventSkills
          .filter((s) => String(s.type).toLowerCase() === "driver")
          .reduce((m, s) => Math.max(m, s.score), 0);

        return {
          event: { id: e.id, name: e.name, start: e.start, end: e.end, level: e.level },
          rank: rank?.rank ?? null,
          wins: rank?.wins ?? null,
          losses: rank?.losses ?? null,
          ties: rank?.ties ?? null,
          progScore: bestProg || null,
          driverScore: bestDriver || null,
          skillsScore: bestProg + bestDriver || null,
          awards: awardsByEvent.get(e.id) ?? [],
        };
      });

    // Season totals.
    const bestProg = skills
      .filter((s) => String(s.type).toLowerCase() === "programming")
      .reduce((m, s) => Math.max(m, s.score), 0);
    const bestDriver = skills
      .filter((s) => String(s.type).toLowerCase() === "driver")
      .reduce((m, s) => Math.max(m, s.score), 0);

    return NextResponse.json({
      team,
      season,
      totalAwards: awards.length,
      totalEvents: events.length,
      bestSkillsScore: bestProg + bestDriver || null,
      bestProg: bestProg || null,
      bestDriver: bestDriver || null,
      bestEventRank: rankings.length
        ? Math.min(...rankings.map((r) => r.rank))
        : null,
      events: eventSummaries,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
