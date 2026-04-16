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
    let seasonName: string;
    if (seasonParam && Number.isFinite(Number(seasonParam))) {
      seasonId = Number(seasonParam);
      seasonName = `Season ${seasonId}`;
    } else {
      const season = await findCurrentSeason(programDef.id);
      seasonId = season.id;
      seasonName = season.name;
    }

    const rows = await getAllCachedRows(seasonId, grade);

    // Sort by skills score desc.
    rows.sort((a, b) => (b.skillsScore ?? 0) - (a.skillsScore ?? 0));

    // Assign rank.
    const ranked = rows.map((r, i) => ({ ...r, computedRank: i + 1 }));

    return NextResponse.json({
      seasonId,
      seasonName,
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
