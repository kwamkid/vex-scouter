"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  AlertTriangle,
  Calendar,
  MapPin,
  Users,
  Loader2,
  Zap,
  Filter,
  X,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RankingTable } from "@/components/RankingTable";
import { parseTeamInput } from "@/lib/parse/team-input";
import type { Division, EventRef, Team } from "@/lib/robotevents/schemas";
import type { TeamRow } from "@/types";
import { aggregateTeamStub } from "@/lib/ranking/stub";
import { CountrySelect } from "./CountrySelect";

type Props = {
  event: EventRef;
  teams: Team[];
  myTeam?: string;
  programCode: string;
  seasonId?: number | null;
  divisions: Division[];
  teamDivisionMap: Record<number, number>;
};

export function EventScoutView({
  event,
  teams,
  myTeam,
  programCode,
  seasonId,
  divisions,
  teamDivisionMap,
}: Props) {
  const myTeamUpper = myTeam?.toUpperCase();
  const hasMultipleDivisions = divisions.length > 1;

  const myTeamObj = useMemo(
    () =>
      myTeamUpper
        ? teams.find((t) => t.number.toUpperCase() === myTeamUpper)
        : undefined,
    [teams, myTeamUpper],
  );
  const myDivisionId = myTeamObj
    ? teamDivisionMap[myTeamObj.id]
    : undefined;

  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(
    () => {
      if (!hasMultipleDivisions) return null;
      if (myDivisionId) return myDivisionId;
      return divisions[0]?.id ?? null;
    },
  );

  // Search filter: matches team number, name, organization.
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string | null>(null);

  const allCountries = useMemo(() => {
    const set = new Set<string>();
    for (const t of teams) {
      const c = t.location?.country?.trim();
      if (c) set.add(c);
    }
    return [...set].sort();
  }, [teams]);

  // Manual filter: user pastes team numbers from their division.
  const [manualFilterOpen, setManualFilterOpen] = useState(false);
  const [manualText, setManualText] = useState("");
  const manualNumbers = useMemo(() => {
    if (!manualFilterOpen || !manualText.trim()) return null;
    return new Set(parseTeamInput(manualText).map((n) => n.toUpperCase()));
  }, [manualFilterOpen, manualText]);

  const filteredTeams = useMemo(() => {
    let pool = teams;
    // Division filter (API-based, if multiple divisions + rankings available).
    if (hasMultipleDivisions && selectedDivisionId != null) {
      pool = pool.filter(
        (t) => teamDivisionMap[t.id] === selectedDivisionId,
      );
    }
    // Manual filter (user-supplied list).
    if (manualNumbers && manualNumbers.size > 0) {
      pool = pool.filter((t) =>
        manualNumbers.has(t.number.toUpperCase()),
      );
    }
    // Country filter.
    if (countryFilter) {
      pool = pool.filter(
        (t) => (t.location?.country?.trim() ?? "") === countryFilter,
      );
    }
    // Text search filter.
    const q = search.trim().toLowerCase();
    if (q) {
      pool = pool.filter(
        (t) =>
          t.number.toLowerCase().includes(q) ||
          (t.team_name ?? "").toLowerCase().includes(q) ||
          (t.organization ?? "").toLowerCase().includes(q) ||
          (t.location?.city ?? "").toLowerCase().includes(q),
      );
    }
    return pool;
  }, [teams, hasMultipleDivisions, selectedDivisionId, teamDivisionMap, manualNumbers, countryFilter, search]);

  // Phase 1: stub rows from basic team info (instant, no extra API calls).
  const stubRows = useMemo(
    () => filteredTeams.map(aggregateTeamStub),
    [filteredTeams],
  );

  // Phase 2: fully-scouted rows, populated lazily per team id.
  const [scoutedById, setScoutedById] = useState<Map<number, TeamRow>>(
    () => new Map(),
  );
  const [scoutingIds, setScoutingIds] = useState<Set<number>>(new Set());
  const [failedIds, setFailedIds] = useState<Set<number>>(new Set());
  const [bulkPending, startBulk] = useTransition();
  const [bulkDone, setBulkDone] = useState(false);

  const rows: TeamRow[] = useMemo(() => {
    const merged = stubRows.map((r) =>
      r.teamId != null && scoutedById.has(r.teamId)
        ? scoutedById.get(r.teamId)!
        : r,
    );
    if (myTeamUpper) {
      merged.sort((a, b) => {
        const aMe = a.teamNumber.toUpperCase() === myTeamUpper ? 0 : 1;
        const bMe = b.teamNumber.toUpperCase() === myTeamUpper ? 0 : 1;
        return aMe - bMe;
      });
    }
    return merged;
  }, [stubRows, scoutedById, myTeamUpper]);

  const totalTeams = filteredTeams.length;
  const scoutedCount = filteredTeams.reduce(
    (n, t) => (scoutedById.has(t.id) ? n + 1 : n),
    0,
  );

  async function scoutOne(teamId: number): Promise<TeamRow | null> {
    if (scoutedById.has(teamId)) return scoutedById.get(teamId)!;
    setScoutingIds((s) => new Set(s).add(teamId));
    try {
      const qs = new URLSearchParams({ program: programCode });
      if (seasonId) qs.set("season", String(seasonId));
      const res = await fetch(`/api/teams/${teamId}/scout?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "scout failed");
      const row = json.row as TeamRow;
      setScoutedById((prev) => {
        const next = new Map(prev);
        next.set(teamId, row);
        return next;
      });
      return row;
    } catch {
      setFailedIds((s) => new Set(s).add(teamId));
      return null;
    } finally {
      setScoutingIds((s) => {
        const next = new Set(s);
        next.delete(teamId);
        return next;
      });
    }
  }

  // Auto-scout myTeam exactly once after mount.
  useEffect(() => {
    if (!myTeamObj) return;
    if (scoutedById.has(myTeamObj.id) || scoutingIds.has(myTeamObj.id)) return;
    void scoutOne(myTeamObj.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTeamObj?.id]);

  function scoutAll() {
    setBulkDone(false);
    startBulk(async () => {
      for (const t of filteredTeams) {
        if (scoutedById.has(t.id) || scoutingIds.has(t.id)) continue;
        await scoutOne(t.id);
      }
      setBulkDone(true);
    });
  }

  const bulkProgress = totalTeams > 0 ? (scoutedCount / totalTeams) * 100 : 0;
  const remaining = totalTeams - scoutedCount;
  // ~0.7s per team (rate limited), rough ETA
  const etaSeconds = Math.ceil(remaining * 0.7);
  const etaLabel =
    etaSeconds > 60
      ? `~${Math.ceil(etaSeconds / 60)} min left`
      : `~${etaSeconds}s left`;

  const homeHref = myTeam
    ? `/?team=${encodeURIComponent(myTeam)}&program=${programCode}`
    : "/";

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Image
            src="/logo.svg"
            alt=""
            width={40}
            height={40}
            className="shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight sm:text-xl">
              Event scout
            </h1>
            {myTeam && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Your team:{" "}
                <span className="font-mono font-semibold text-primary">
                  {myTeam}
                </span>
              </p>
            )}
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={homeHref}>
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
        </Button>
      </header>

      <EventHeader
        event={event}
        myTeam={myTeam}
        teamCount={totalTeams}
        currentDivision={
          hasMultipleDivisions && selectedDivisionId != null
            ? divisions.find((d) => d.id === selectedDivisionId)?.name
            : undefined
        }
      />

      {hasMultipleDivisions && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">
              Division
            </span>
            <select
              value={selectedDivisionId ?? ""}
              onChange={(e) => setSelectedDivisionId(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {myDivisionId === d.id ? " (your team)" : ""}
                </option>
              ))}
            </select>
          </label>
          {myTeamObj && !myDivisionId && (
            <span className="text-[11px] text-muted-foreground">
              Your team&apos;s division isn&apos;t assigned yet — showing{" "}
              {divisions.find((d) => d.id === selectedDivisionId)?.name ??
                "first"}
              .
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team, name, org…"
            spellCheck={false}
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <CountrySelect
          countries={allCountries}
          value={countryFilter}
          onChange={setCountryFilter}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            <Zap className="inline h-3.5 w-3.5 mr-1 -mt-0.5 text-primary" />
            Click a team to scout its season stats, or scout them all.
            <span className="ml-2 font-mono text-foreground">
              {scoutedCount}/{totalTeams} scouted
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setManualFilterOpen((v) => !v)}
            >
              {manualFilterOpen ? (
                <>
                  <X className="h-4 w-4" /> Close filter
                </>
              ) : (
                <>
                  <Filter className="h-4 w-4" /> Manual scout
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={scoutAll}
              disabled={bulkPending || scoutedCount >= totalTeams}
            >
              {bulkPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Scouting…
                </>
              ) : scoutedCount >= totalTeams ? (
                <>All scouted</>
              ) : (
                <>Scout all {totalTeams}</>
              )}
            </Button>
          </div>
        </div>

        {(bulkPending || bulkDone) && (
          <div className="space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${bulkProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                <span className="font-mono text-foreground">
                  {scoutedCount}
                </span>
                /{totalTeams} scouted
                {failedIds.size > 0 && (
                  <span className="ml-2 text-destructive">
                    {failedIds.size} failed
                  </span>
                )}
              </span>
              {bulkPending && remaining > 0 && (
                <span className="font-mono">{etaLabel}</span>
              )}
              {bulkDone && (
                <span className="text-primary font-medium">
                  Done — click a column header to sort
                </span>
              )}
            </div>
          </div>
        )}

        {manualFilterOpen && (
          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              Paste the team numbers from your division — one per line. Only
              matching teams will be shown and scouted.
            </p>
            <Textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={"2989A\n13A\n90X"}
              className="min-h-[100px]"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {manualNumbers && manualNumbers.size > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Showing{" "}
                  <span className="font-mono font-semibold text-primary">
                    {filteredTeams.length}
                  </span>{" "}
                  of {teams.length} teams.
                  <button
                    type="button"
                    onClick={() => {
                      setManualText("");
                      setManualFilterOpen(false);
                    }}
                    className="ml-2 text-primary hover:underline"
                  >
                    Clear
                  </button>
                </p>
              ) : (
                <span />
              )}
              <Button
                size="sm"
                onClick={scoutAll}
                disabled={
                  bulkPending ||
                  filteredTeams.length === 0 ||
                  scoutedCount >= totalTeams
                }
              >
                {bulkPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Scouting…
                  </>
                ) : (
                  <>Scout {totalTeams} teams</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {rows.length > 0 ? (
        <RankingTable
          rows={rows}
          programCode={programCode}
          highlightTeam={myTeam}
          onRowExpand={scoutOne}
          scoutingIds={scoutingIds}
          failedIds={failedIds}
          seasonId={seasonId ?? undefined}
        />
      ) : (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No teams registered for this event yet.
        </div>
      )}
    </div>
  );
}

function EventHeader({
  event,
  myTeam,
  teamCount,
  currentDivision,
}: {
  event: EventRef;
  myTeam?: string;
  teamCount: number;
  currentDivision?: string;
}) {
  const start = event.start ? new Date(event.start) : null;
  const end = event.end ? new Date(event.end) : null;
  const location = [
    event.location?.venue,
    event.location?.city,
    event.location?.region,
    event.location?.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        {event.program?.code && (
          <Badge variant="brand" className="text-[10px]">
            {event.program.code}
          </Badge>
        )}
        {event.level && (
          <Badge variant="muted" className="text-[10px]">
            {event.level}
          </Badge>
        )}
        {event.ongoing && (
          <Badge variant="brand" className="text-[10px]">
            Ongoing
          </Badge>
        )}
        {currentDivision && (
          <Badge variant="brand" className="text-[10px]">
            Division: {currentDivision}
          </Badge>
        )}
      </div>
      <h2 className="mt-2 text-base font-semibold text-foreground sm:text-lg">
        {event.name}
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {start && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatRange(start, end)}
          </span>
        )}
        {location && (
          <span className="flex items-center gap-1 min-w-0">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{location}</span>
          </span>
        )}
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {teamCount} team{teamCount !== 1 ? "s" : ""}
        </span>
      </div>
      {myTeam && (
        <p className="mt-3 text-xs text-muted-foreground">
          Your team{" "}
          <span className="font-mono font-semibold text-primary">{myTeam}</span>{" "}
          is pinned to the top of the list.
        </p>
      )}
    </div>
  );
}

function formatRange(start: Date, end: Date | null): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  const s = start.toLocaleDateString("en-US", opts);
  if (!end || start.toDateString() === end.toDateString()) return s;
  const e = end.toLocaleDateString("en-US", opts);
  return `${s} – ${e}`;
}

// Unused helper kept for future error UI.
export function _errorBanner(_: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:p-6">
      <AlertTriangle className="h-5 w-5 text-destructive" />
    </div>
  );
}
