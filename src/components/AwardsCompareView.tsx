"use client";

import { useEffect, useState } from "react";
import { Plus, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { cn } from "@/lib/utils";
import { PROGRAMS, type ProgramCode } from "@/lib/robotevents/programs";
import type { Award, Team } from "@/lib/robotevents/schemas";
import {
  EventAwardsCard,
  groupAwardsByEvent,
  type AwardEvent,
} from "./EventAwards";

const STORAGE_KEY = "vex-scout:awards-compare";

const PROGRAM_DISPLAY: Record<ProgramCode, string> = {
  VIQRC: "VEX IQ",
  V5RC: "VEX V5",
  VURC: "VEX U",
  VAIRC: "VEX AI",
};
const PROGRAM_ORDER: ProgramCode[] = ["VIQRC", "V5RC", "VURC", "VAIRC"];

type SeasonOption = { id: number; name: string; start?: string | null };

type EventSummary = {
  event: AwardEvent;
  awards: Award[];
};

type ProfileData = {
  team: Team;
  totalAwards: number;
  totalEvents: number;
  bestEventRank: number | null;
  events: EventSummary[];
};

// Per-team result: distinguishing in-flight, loaded, and failed lookups so
// the UI can show a spinner or an inline error per card.
type TeamResult =
  | { state: "loading" }
  | { state: "ok"; data: ProfileData }
  | { state: "error"; message: string };

export function AwardsCompareView() {
  const [programCode, setProgramCode] = useState<ProgramCode>("VIQRC");
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [seasonsLoading, setSeasonsLoading] = useState(false);

  const [pendingInput, setPendingInput] = useState("");
  const [teamNumbers, setTeamNumbers] = useState<string[]>([]);
  const [results, setResults] = useState<Map<string, TeamResult>>(new Map());

  // Load saved state.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          program?: string;
          teams?: string[];
        };
        if (
          saved.program &&
          PROGRAMS.some((p) => p.code === saved.program)
        ) {
          setProgramCode(saved.program as ProgramCode);
        }
        if (Array.isArray(saved.teams)) {
          setTeamNumbers(saved.teams.filter((t) => typeof t === "string"));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist program + team list.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ program: programCode, teams: teamNumbers }),
      );
    } catch {
      // ignore
    }
  }, [programCode, teamNumbers]);

  // Load seasons whenever program changes; reset cached results because awards
  // belong to a (program, season) pair.
  useEffect(() => {
    setSeasonsLoading(true);
    setSeasons([]);
    setSeasonId(null);
    setResults(new Map());
    fetch(`/api/seasons?program=${encodeURIComponent(programCode)}`)
      .then((r) => r.json())
      .then((json) => {
        const list = (json.seasons ?? []) as SeasonOption[];
        const sorted = [...list].sort((a, b) => {
          const aT = a.start ? new Date(a.start).getTime() : 0;
          const bT = b.start ? new Date(b.start).getTime() : 0;
          return bT - aT;
        });
        setSeasons(sorted);
        const now = Date.now();
        const started = sorted.find(
          (s) => s.start && new Date(s.start).getTime() <= now,
        );
        setSeasonId(started?.id ?? sorted[0]?.id ?? null);
      })
      .catch(() => setSeasons([]))
      .finally(() => setSeasonsLoading(false));
  }, [programCode]);

  // Re-fetch every team in the list whenever the (program, season) pair
  // changes — results from one season aren't valid for another.
  useEffect(() => {
    if (!seasonId || teamNumbers.length === 0) return;
    let cancelled = false;
    const next = new Map<string, TeamResult>();
    for (const t of teamNumbers) next.set(t, { state: "loading" });
    setResults(next);

    Promise.all(
      teamNumbers.map((t) =>
        fetchProfile(t, programCode, seasonId).then((r) => ({ t, r })),
      ),
    ).then((entries) => {
      if (cancelled) return;
      setResults((prev) => {
        const m = new Map(prev);
        for (const { t, r } of entries) m.set(t, r);
        return m;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [seasonId, programCode, teamNumbers]);

  function addTeam(raw: string) {
    const t = raw.trim().toUpperCase();
    if (!t) return;
    if (teamNumbers.includes(t)) {
      setPendingInput("");
      return;
    }
    setTeamNumbers((prev) => [...prev, t]);
    setPendingInput("");
  }

  function removeTeam(t: string) {
    setTeamNumbers((prev) => prev.filter((x) => x !== t));
    setResults((prev) => {
      const m = new Map(prev);
      m.delete(t);
      return m;
    });
  }

  function clearAll() {
    setTeamNumbers([]);
    setResults(new Map());
  }

  return (
    <div className="space-y-5">
      {/* Pickers */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Program
          </span>
          <select
            value={programCode}
            onChange={(e) => setProgramCode(e.target.value as ProgramCode)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {PROGRAM_ORDER.map((code) => (
              <option key={code} value={code}>
                {PROGRAM_DISPLAY[code]} ({code})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Season
          </span>
          <select
            value={seasonId ?? ""}
            onChange={(e) => setSeasonId(Number(e.target.value))}
            disabled={seasonsLoading || seasons.length === 0}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {seasonsLoading && <option>Loading…</option>}
            {!seasonsLoading && seasons.length === 0 && (
              <option>No seasons</option>
            )}
            {!seasonsLoading &&
              seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {shortSeason(s.name)}
                </option>
              ))}
          </select>
        </label>
      </div>

      {/* Team add input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addTeam(pendingInput);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={pendingInput}
          onChange={(e) => setPendingInput(e.target.value)}
          placeholder="Add team number (e.g. 2999K)"
          spellCheck={false}
          className="flex h-11 flex-1 rounded-md border border-input bg-background px-3 text-base font-mono uppercase text-foreground placeholder:text-muted-foreground placeholder:normal-case focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="lg" disabled={!pendingInput.trim()}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add</span>
        </Button>
        {teamNumbers.length > 0 && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={clearAll}
          >
            Clear
          </Button>
        )}
      </form>

      {/* Empty state */}
      {teamNumbers.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
          <Trophy className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-foreground">
            Add team numbers above to compare their awards.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            All teams must compete in{" "}
            <span className="font-semibold text-foreground">
              {PROGRAM_DISPLAY[programCode]}
            </span>{" "}
            for the season you pick.
          </p>
        </div>
      )}

      {/* Results grid: 1 col mobile, 2 col tablet, 3 col desktop. */}
      {teamNumbers.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teamNumbers.map((t) => (
            <TeamAwardsColumn
              key={t}
              teamNumber={t}
              result={results.get(t) ?? { state: "loading" }}
              onRemove={() => removeTeam(t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamAwardsColumn({
  teamNumber,
  result,
  onRemove,
}: {
  teamNumber: string;
  result: TeamResult;
  onRemove: () => void;
}) {
  return (
    <section className="flex flex-col rounded-lg border border-border bg-card">
      <header className="flex items-start gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-base font-bold text-primary">
              {teamNumber}
            </span>
            {result.state === "ok" && (
              <span className="truncate text-sm text-foreground">
                {result.data.team.team_name ?? "—"}
              </span>
            )}
          </div>
          {result.state === "ok" && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>
                <span className="font-mono font-semibold text-foreground">
                  {result.data.totalAwards}
                </span>{" "}
                awards
              </span>
              <span>
                <span className="font-mono font-semibold text-foreground">
                  {result.data.totalEvents}
                </span>{" "}
                events
              </span>
              {result.data.bestEventRank != null && (
                <span>
                  best #{result.data.bestEventRank}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${teamNumber}`}
          className={cn(
            "shrink-0 rounded-md p-1 text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground",
          )}
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="p-3">
        {result.state === "loading" && <LoadingState />}
        {result.state === "error" && (
          <ErrorAlert message={result.message} />
        )}
        {result.state === "ok" &&
          (result.data.totalAwards === 0 ? (
            <p className="text-xs text-muted-foreground">
              No awards this season.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {groupAwardsByEvent(result.data.events).map(
                ({ event, awards }) => (
                  <EventAwardsCard
                    key={event.id}
                    event={event}
                    awards={awards}
                  />
                ),
              )}
            </ul>
          ))}
      </div>
    </section>
  );
}

async function fetchProfile(
  team: string,
  program: ProgramCode,
  seasonId: number,
): Promise<TeamResult> {
  try {
    const qs = new URLSearchParams({
      team,
      season: String(seasonId),
      program,
    });
    const res = await fetch(`/api/team-profile?${qs.toString()}`);
    const json = await res.json();
    if (!res.ok) {
      return {
        state: "error",
        message: (json.error as string) ?? `lookup failed (${res.status})`,
      };
    }
    return { state: "ok", data: json as ProfileData };
  } catch (err) {
    return { state: "error", message: (err as Error).message };
  }
}

function shortSeason(name: string): string {
  const match = name.match(/(\d{4}-\d{4}.*)$/);
  return match ? match[1] : name;
}
