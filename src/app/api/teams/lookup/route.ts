import { NextResponse } from "next/server";
import { z } from "zod";
import { buildTeamRows } from "@/lib/ranking/orchestrator";
import { parseTeamInput } from "@/lib/parse/team-input";
import { findProgram, defaultGradeFor } from "@/lib/robotevents/programs";

const BodySchema = z.object({
  teams: z.array(z.string()).max(100),
  program: z.string().optional(),
  grade: z.string().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const numbers = parseTeamInput(parsed.data.teams.join("\n"), 100);
  if (!numbers.length) {
    return NextResponse.json(
      { error: "No valid team numbers" },
      { status: 400 },
    );
  }

  const programDef =
    findProgram(parsed.data.program ?? "V5RC") ?? findProgram("V5RC")!;
  const grade = parsed.data.grade ?? defaultGradeFor(programDef.code);

  try {
    const result = await buildTeamRows(numbers, {
      programId: programDef.id,
      grade: grade as never,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
