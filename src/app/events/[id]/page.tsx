import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { LoadingProgress } from "@/components/LoadingProgress";
import { EventScoutView } from "@/components/EventScoutView";
import { AppShell } from "@/components/AppShell";
import {
  getDivisionRankings,
  getEvent,
  getEventTeams,
} from "@/lib/robotevents/events";
import { findProgram } from "@/lib/robotevents/programs";
import type { Division, EventRef } from "@/lib/robotevents/schemas";

export const dynamic = "force-dynamic";

export default async function EventPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ myTeam?: string; program?: string; season?: string }>;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const eventId = Number(id);
  const myTeam = sp.myTeam?.toUpperCase();
  const programCode = (sp.program ?? "V5RC").toUpperCase();
  const programDef = findProgram(programCode) ?? findProgram("V5RC")!;
  const seasonId = sp.season ? Number(sp.season) : null;

  if (!Number.isFinite(eventId)) {
    return (
      <AppShell maxWidth="3xl">
        <ErrorBanner title="Invalid event" message={`Bad event id: ${id}`} />
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth="7xl">
      <Suspense fallback={<LoadingShell />}>
        <EventBody
          eventId={eventId}
          myTeam={myTeam}
          programCode={programDef.code}
          seasonId={seasonId}
        />
      </Suspense>
    </AppShell>
  );
}

async function EventBody({
  eventId,
  myTeam,
  programCode,
  seasonId,
}: {
  eventId: number;
  myTeam?: string;
  programCode: string;
  seasonId: number | null;
}) {
  let event: EventRef;
  try {
    event = await getEvent(eventId);
  } catch (err) {
    return (
      <ErrorBanner
        title="Failed to load event"
        message={(err as Error).message}
      />
    );
  }

  let teams: Awaited<ReturnType<typeof getEventTeams>> = [];
  let teamsError: string | null = null;
  try {
    teams = await getEventTeams(eventId);
  } catch (err) {
    teamsError = (err as Error).message;
  }

  // If there's more than one division, fetch per-division rankings so we can
  // filter the roster by division. Done on the server so the client gets a
  // ready-to-render teamDivisionMap (team id → division id).
  const divisions: Division[] = event.divisions ?? [];
  const multipleDivisions = divisions.length > 1;
  const teamDivisionMap: Record<number, number> = {};
  const rankingsPerDivision: { division: string; count: number }[] = [];
  if (multipleDivisions) {
    const results = await Promise.all(
      divisions.map((d) =>
        getDivisionRankings(eventId, d.id).catch(() => []),
      ),
    );
    divisions.forEach((d, i) => {
      rankingsPerDivision.push({ division: d.name, count: results[i].length });
      for (const r of results[i]) {
        if (r.team?.id != null) teamDivisionMap[r.team.id] = d.id;
      }
    });
  }

  // Server-side trace so we can see in the Next.js dev console why the
  // division filter would or wouldn't produce rows.
  console.log(
    `[event:${eventId}] teams=${teams.length}` +
      ` divisions=${divisions.length}` +
      ` divisionMapEntries=${Object.keys(teamDivisionMap).length}` +
      (rankingsPerDivision.length > 0
        ? ` rankings=${rankingsPerDivision
            .map((r) => `${r.division}:${r.count}`)
            .join(",")}`
        : ""),
  );

  if (teamsError && teams.length === 0) {
    return <ErrorBanner title="Failed to load teams" message={teamsError} />;
  }

  return (
    <EventScoutView
      event={event}
      teams={teams}
      myTeam={myTeam}
      programCode={programCode}
      seasonId={seasonId}
      divisions={divisions}
      teamDivisionMap={teamDivisionMap}
    />
  );
}

function LoadingShell() {
  return (
    <div className="space-y-5">
      <div className="text-base font-bold">Loading event…</div>
      <LoadingProgress />
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
    </div>
  );
}
