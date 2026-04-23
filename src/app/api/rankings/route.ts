import { NextResponse } from "next/server";
import { getAllCachedRows } from "@/lib/db/adapter";
import { findCurrentSeason } from "@/lib/robotevents/season";
import { findProgram } from "@/lib/robotevents/programs";
import { reGetAllPaged } from "@/lib/robotevents/client";
import { SeasonSchema } from "@/lib/robotevents/schemas";

async function lookupSeasonName(
  programId: number,
  seasonId: number,
): Promise<string> {
  const seasons = await reGetAllPaged(
    "/seasons",
    { "program[]": programId },
    SeasonSchema,
    { revalidate: 60 * 60 * 24, tags: ["seasons", `seasons:${programId}`] },
    3,
  );
  const match = seasons.find((s) => s.id === seasonId);
  return match?.name ?? `Season ${seasonId}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const programCode = (url.searchParams.get("program") ?? "V5RC").toUpperCase();
  const grade = url.searchParams.get("grade") ?? null;
  const seasonParam = url.searchParams.get("season");
  const programDef = findProgram(programCode) ?? findProgram("V5RC")!;

  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? "25") || 25),
  );
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  try {
    let seasonId: number;
    let seasonName: string;
    if (seasonParam && Number.isFinite(Number(seasonParam))) {
      seasonId = Number(seasonParam);
      seasonName = await lookupSeasonName(programDef.id, seasonId);
    } else {
      const season = await findCurrentSeason(programDef.id);
      seasonId = season.id;
      seasonName = season.name;
    }

    let rows = await getAllCachedRows(seasonId, grade, programDef.id);

    // Sort by skills score desc (global ranking order).
    rows.sort((a, b) => (b.skillsScore ?? 0) - (a.skillsScore ?? 0));
    const withRank = rows.map((r, i) => ({ ...r, computedRank: i + 1 }));

    // Search filter (applied after ranking so rank numbers stay global).
    const filtered = q
      ? withRank.filter(
          (r) =>
            r.teamNumber.toLowerCase().includes(q) ||
            (r.teamName ?? "").toLowerCase().includes(q),
        )
      : withRank;

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const pageRows = filtered.slice(start, start + pageSize);

    return NextResponse.json({
      seasonId,
      seasonName,
      total,
      page,
      pageSize,
      rows: pageRows,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
