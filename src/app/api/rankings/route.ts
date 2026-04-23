import { NextResponse } from "next/server";
import { getAllCachedRows } from "@/lib/db/adapter";
import { findCurrentSeason } from "@/lib/robotevents/season";
import { findProgram } from "@/lib/robotevents/programs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const programCode = (url.searchParams.get("program") ?? "V5RC").toUpperCase();
  const grade = url.searchParams.get("grade") ?? null;
  const seasonParam = url.searchParams.get("season");
  const programDef = findProgram(programCode) ?? findProgram("V5RC")!;

  try {
    let seasonId: number;
    if (seasonParam && Number.isFinite(Number(seasonParam))) {
      seasonId = Number(seasonParam);
    } else {
      const season = await findCurrentSeason(programDef.id);
      seasonId = season.id;
    }

    const rows = await getAllCachedRows(seasonId, grade, programDef.id);

    // Sort by skills score desc and assign global rank. Search + pagination
    // happen client-side so the user gets instant filtering.
    rows.sort((a, b) => (b.skillsScore ?? 0) - (a.skillsScore ?? 0));
    const ranked = rows.map((r, i) => ({ ...r, computedRank: i + 1 }));

    return NextResponse.json({
      seasonId,
      total: ranked.length,
      rows: ranked,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
