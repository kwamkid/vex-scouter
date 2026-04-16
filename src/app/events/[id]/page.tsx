import { Suspense } from "react";
import Image from "next/image";
import { AlertTriangle } from "lucide-react";
import { LoadingProgress } from "@/components/LoadingProgress";
import { EventScoutView } from "@/components/EventScoutView";
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
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <ErrorBanner title="Invalid event" message={`Bad event id: ${id}`} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <Suspense fallback={<LoadingShell />}>
          <EventBody
            eventId={eventId}
            myTeam={myTeam}
            programCode={programDef.code}
            seasonId={seasonId}
          />
        </Suspense>
      </div>
    </main>
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
  if (multipleDivisions) {
    const results = await Promise.all(
      divisions.map((d) =>
        getDivisionRankings(eventId, d.id).catch(() => []),
      ),
    );
    divisions.forEach((d, i) => {
      for (const r of results[i]) {
        if (r.team?.id != null) teamDivisionMap[r.team.id] = d.id;
      }
    });
  }

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
      <header className="flex items-center gap-3">
        <Image src="/logo.svg" alt="" width={40} height={40} />
        <div className="text-base font-bold">Loading event…</div>
      </header>
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
