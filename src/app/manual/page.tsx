import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { RankingTable } from "@/components/RankingTable";
import { RefreshButton } from "@/components/RefreshButton";
import { LoadingProgress } from "@/components/LoadingProgress";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { parseTeamInput } from "@/lib/parse/team-input";
import { buildTeamRows } from "@/lib/ranking/orchestrator";
import {
  findProgram,
  defaultGradeFor,
  type GradeLevel,
  type ProgramCode,
} from "@/lib/robotevents/programs";
import { ManualInput } from "@/components/ManualInput";

export const dynamic = "force-dynamic";

export default async function ManualPage(props: {
  searchParams: Promise<{
    teams?: string | string[];
    program?: string;
    grade?: string;
  }>;
}) {
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.teams) ? sp.teams.join(",") : (sp.teams ?? "");
  const teams = parseTeamInput(raw, 100);

  const programCode = ((typeof sp.program === "string"
    ? sp.program.toUpperCase()
    : "V5RC") as ProgramCode);
  const programDef = findProgram(programCode) ?? findProgram("V5RC")!;
  const grade = ((typeof sp.grade === "string"
    ? sp.grade
    : defaultGradeFor(programDef.code)) as GradeLevel);

  return (
    <AppShell maxWidth="7xl">
      <PageHeader
        title={
          teams.length > 0
            ? `Manual compare — ${teams.length} team${teams.length !== 1 ? "s" : ""}`
            : "Manual compare"
        }
        subtitle="Paste team numbers and compare side by side."
        badge={
          teams.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="brand" className="text-[10px]">
                {programDef.code}
              </Badge>
              <Badge variant="muted" className="text-[10px]">
                {grade}
              </Badge>
            </div>
          ) : undefined
        }
      />

      {teams.length < 1 ? (
        <EmptyState />
      ) : (
        <Suspense fallback={<LoadingProgress />}>
          <CompareBody
            teams={teams}
            programId={programDef.id}
            programCode={programDef.code}
            grade={grade}
          />
        </Suspense>
      )}
    </AppShell>
  );
}

async function CompareBody({
  teams,
  programId,
  programCode,
  grade,
}: {
  teams: string[];
  programId: number;
  programCode: ProgramCode;
  grade: GradeLevel;
}) {
  let result;
  try {
    result = await buildTeamRows(teams, { programId, grade });
  } catch (err) {
    return (
      <ErrorBanner
        title="Failed to load from RobotEvents"
        message={(err as Error).message}
      />
    );
  }

  const teamIds = result.rows
    .map((r) => r.teamId)
    .filter((x): x is number => x !== null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Season:{" "}
          <span className="font-mono text-foreground">{result.seasonName}</span>
        </p>
        <div className="flex justify-end">
          <RefreshButton teamIds={teamIds} />
        </div>
      </div>

      {result.partial && result.errorMessage && (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="min-w-0">
            Partial data — RobotEvents returned an error for part of the request.
            <span className="ml-1 font-mono opacity-70 break-all">
              ({result.errorMessage})
            </span>
          </div>
        </div>
      )}

      <RankingTable rows={result.rows} programCode={programCode} />
    </div>
  );
}

function ErrorBanner({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:p-6">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-5 w-5" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      <p className="mt-2 text-sm text-foreground font-mono break-all">
        {message}
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        Check that <span className="font-mono">ROBOTEVENTS_TOKEN</span> is set
        in <span className="font-mono">.env.local</span> and that the token is
        valid.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <h2 className="mb-2 text-sm font-semibold text-foreground">
        Paste team numbers
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        One team per line — copy directly from Excel. Examples:{" "}
        <span className="font-mono">2989A</span>,{" "}
        <span className="font-mono">12345B</span>
      </p>
      <ManualInput />
    </section>
  );
}
