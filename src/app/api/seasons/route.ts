import { NextResponse } from "next/server";
import { reGetAllPaged } from "@/lib/robotevents/client";
import { SeasonSchema } from "@/lib/robotevents/schemas";
import { findProgram } from "@/lib/robotevents/programs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const programCode = (url.searchParams.get("program") ?? "V5RC").toUpperCase();
  const programDef = findProgram(programCode) ?? findProgram("V5RC")!;

  try {
    const seasons = await reGetAllPaged(
      "/seasons",
      { "program[]": programDef.id },
      SeasonSchema,
      {
        revalidate: 60 * 60 * 24,
        tags: ["seasons", `seasons:${programDef.id}`],
      },
      3,
    );

    const now = Date.now();
    const filtered = seasons
      .filter((s) => {
        const start = s.start ? new Date(s.start).getTime() : 0;
        return start <= now;
      })
      .sort((a, b) => {
        const aStart = a.start ? new Date(a.start).getTime() : 0;
        const bStart = b.start ? new Date(b.start).getTime() : 0;
        return bStart - aStart;
      });

    const futureNext = seasons
      .filter((s) => {
        const start = s.start ? new Date(s.start).getTime() : 0;
        return start > now;
      })
      .sort((a, b) => {
        const aStart = a.start ? new Date(a.start).getTime() : 0;
        const bStart = b.start ? new Date(b.start).getTime() : 0;
        return aStart - bStart;
      })
      .slice(0, 1);

    return NextResponse.json({
      seasons: [...futureNext, ...filtered].map((s) => ({
        id: s.id,
        name: s.name,
        start: s.start,
        end: s.end,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}
