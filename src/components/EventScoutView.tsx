"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Zap,
  Filter,
  X,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { RankingTable } from "@/components/RankingTable";
import { EventMatches, formatRelative } from "@/components/EventMatches";
import { cn } from "@/lib/utils";
import { parseTeamInput } from "@/lib/parse/team-input";
import { findProgram, type ProgramCode } from "@/lib/robotevents/programs";
import type { Division, EventRef, Team } from "@/lib/robotevents/schemas";
import type { TeamRow } from "@/types";
import { aggregateTeamStub } from "@/lib/ranking/stub";
import { leagueFromProgram } from "@/lib/league";
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

  // URL-driven "view as another team" mode. Tapping a team number in the
  // match list pushes ?viewTeam=X; we resolve the team and use it in place
  // of myTeamObj for the matches view. Empty/unset = view own team.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewTeamUpper = searchParams.get("viewTeam")?.toUpperCase() ?? null;
  const viewTeamObj = useMemo(
    () =>
      viewTeamUpper
        ? teams.find((t) => t.number.toUpperCase() === viewTeamUpper)
        : null,
    [teams, viewTeamUpper],
  );
  const activeTeamObj = viewTeamObj ?? myTeamObj;
  const isViewingOther =
    viewTeamObj != null &&
    (!myTeamObj || viewTeamObj.id !== myTeamObj.id);

  // Build the href that swaps to a different team. Returns null for the
  // active team (don't link to self) and for missing context.
  const buildViewTeamHref = useCallback(
    (teamNumber: string): string | null => {
      if (!activeTeamObj) return null;
      if (
        teamNumber.toUpperCase() === activeTeamObj.number.toUpperCase()
      ) {
        return null;
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set("viewTeam", teamNumber);
      return `${pathname}?${params.toString()}`;
    },
    [activeTeamObj, pathname, searchParams],
  );

  // "Back to my matches" link: drop viewTeam from the URL.
  const backToMyMatchesHref = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("viewTeam");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

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

  // Default to the matches tab when we know who "us" is — that's what the
  // user usually wants to see at an event.
  const [tab, setTab] = useState<"matches" | "teams">(() =>
    myTeam ? "matches" : "teams",
  );

  // Cached/refresh chrome lives on the top header row next to "back". We
  // own the refreshTick (incremented by the refresh button) and listen
  // for cache state from EventMatches via onMetaChange.
  const [refreshTick, setRefreshTick] = useState(0);
  const [matchesMeta, setMatchesMeta] = useState<{
    loading: boolean;
    fromCache: boolean;
    cachedAt: number | null;
  }>({ loading: true, fromCache: false, cachedAt: null });

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

  // Division map only has entries once per-division rankings have been
  // published. For future events the map is empty, so the filter would wipe
  // out every team — fall back to showing everyone in that case.
  const hasDivisionAssignments =
    Object.keys(teamDivisionMap).length > 0;

  const filteredTeams = useMemo(() => {
    let pool = teams;
    const hasManual = manualNumbers != null && manualNumbers.size > 0;
    // Division filter (API-based, if multiple divisions + rankings available).
    // Skipped when the user pastes a manual list — that IS their division.
    // Also skipped when no division assignments exist yet (future events).
    if (
      !hasManual &&
      hasMultipleDivisions &&
      hasDivisionAssignments &&
      selectedDivisionId != null
    ) {
      pool = pool.filter(
        (t) => teamDivisionMap[t.id] === selectedDivisionId,
      );
    }
    // Manual filter (user-supplied list).
    if (hasManual) {
      pool = pool.filter((t) => manualNumbers.has(t.number.toUpperCase()));
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
  }, [teams, hasMultipleDivisions, hasDivisionAssignments, selectedDivisionId, teamDivisionMap, manualNumbers, countryFilter, search]);

  const programId = findProgram(programCode)?.id ?? 1;

  // Id → {number, name} lookup for the match history UI.
  const teamNamesMap = useMemo(() => {
    const m = new Map<number, { number: string; name: string | null }>();
    for (const t of teams) {
      m.set(t.id, { number: t.number, name: t.team_name ?? null });
    }
    return m;
  }, [teams]);

  // Phase 1: stub rows from basic team info (instant, no extra API calls).
  const stubRows = useMemo(
    () => filteredTeams.map((t) => aggregateTeamStub(t, programId)),
    [filteredTeams, programId],
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

  async function scoutOne(
    teamId: number,
    force = false,
  ): Promise<TeamRow | null> {
    if (!force && scoutedById.has(teamId)) return scoutedById.get(teamId)!;
    setScoutingIds((s) => new Set(s).add(teamId));
    try {
      const qs = new URLSearchParams({ program: programCode });
      if (seasonId) qs.set("season", String(seasonId));
      if (force) qs.set("refresh", "1");
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

  // Pre-populate scouted rows from the server cache so teams that have been
  // scouted before render instantly, without a RobotEvents round-trip.
  useEffect(() => {
    if (!seasonId) return;
    if (filteredTeams.length === 0) return;
    const ids = filteredTeams.map((t) => t.id);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/teams/cache-batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids, seasonId, programId }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { rows?: TeamRow[] };
        if (cancelled || !json.rows || json.rows.length === 0) return;
        setScoutedById((prev) => {
          const next = new Map(prev);
          for (const row of json.rows!) {
            if (row.teamId != null && !next.has(row.teamId)) {
              next.set(row.teamId, row);
            }
          }
          return next;
        });
      } catch {
        // Non-fatal: cache preload is best-effort.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filteredTeams, seasonId, programId]);

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

  // Back returns to the league-scoped events list with the same team+season
  // query intact, so the user lands on their original results — not a blank
  // form. Falls back to the league picker for non-league programs (VURC/VAIRC).
  const league = leagueFromProgram(programCode as ProgramCode);
  const backParams = new URLSearchParams();
  if (myTeam) backParams.set("team", myTeam);
  if (seasonId) backParams.set("season", String(seasonId));
  const backQs = backParams.toString();
  const homeHref = league
    ? `/${league}${backQs ? `?${backQs}` : ""}`
    : "/";

  // Smart back: when viewing another team, the back arrow returns to "my
  // matches" by dropping ?viewTeam — staying on the same event page. Only
  // when there's no viewTeam does it leave the event and go to the league
  // events list.
  const backHref = isViewingOther ? backToMyMatchesHref : homeHref;
  const backLabel = isViewingOther
    ? `Back to ${myTeamObj?.number ?? myTeam ?? "my matches"}`
    : "Back to events";

  return (
    <div className="space-y-3">
      {/* Header row: back on the left, cached badge + refresh icon on the
          right. Cached info is shown only when EventMatches has reported
          fresh meta and the user is on the matches tab (it's the only tab
          that has a cache to talk about). */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={backHref}
          aria-label={backLabel}
          title={backLabel}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        {tab === "matches" && myTeamObj && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {matchesMeta.fromCache && matchesMeta.cachedAt != null && (
              <>
                <span className="rounded-sm border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                  Cached
                </span>
                <span className="hidden sm:inline">
                  updated {formatRelative(matchesMeta.cachedAt)}
                </span>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefreshTick((t) => t + 1)}
              disabled={matchesMeta.loading}
              aria-label="Refresh"
              title="Bypass cache and re-fetch from RobotEvents"
              className="h-9 w-9 p-0"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  matchesMeta.loading && "animate-spin",
                )}
              />
            </Button>
          </div>
        )}
      </div>

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
          {!hasDivisionAssignments ? (
            <span className="text-[11px] text-muted-foreground">
              Division assignments aren&apos;t published yet — showing all{" "}
              <span className="font-mono text-foreground">{teams.length}</span>{" "}
              teams. Paste your division&apos;s team numbers below to filter.
            </span>
          ) : (
            myTeamObj && !myDivisionId && (
              <span className="text-[11px] text-muted-foreground">
                Your team&apos;s division isn&apos;t assigned yet — showing{" "}
                {divisions.find((d) => d.id === selectedDivisionId)?.name ??
                  "first"}
                .
              </span>
            )
          )}
        </div>
      )}

      <div className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 p-1">
        <TabButton
          active={tab === "matches"}
          onClick={() => setTab("matches")}
          label={
            isViewingOther && viewTeamObj
              ? `${viewTeamObj.number} matches`
              : "My matches"
          }
          disabled={!activeTeamObj}
        />
        <TabButton
          active={tab === "teams"}
          onClick={() => setTab("teams")}
          label="All Teams"
        />
      </div>

      {tab === "matches" && activeTeamObj ? (
        <EventMatches
          eventId={event.id}
          myTeamId={activeTeamObj.id}
          myTeamNumber={activeTeamObj.number}
          teamNames={teamNamesMap}
          scoutedById={scoutedById}
          accent={
            leagueFromProgram(programCode as ProgramCode) ?? undefined
          }
          refreshTick={refreshTick}
          onMetaChange={setMatchesMeta}
          teamLinkBuilder={buildViewTeamHref}
        />
      ) : null}

      {tab === "teams" && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search team, name, org…"
                spellCheck={false}
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <div className="flex flex-wrap items-center gap-2">
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
              onForceRefresh={(id: number) => scoutOne(id, true)}
              scoutingIds={scoutingIds}
              failedIds={failedIds}
              seasonId={seasonId ?? undefined}
              eventId={event.id}
              eventTeamNames={teamNamesMap}
            />
          ) : (
            <EmptyState
              title={
                teams.length === 0
                  ? "No teams registered for this event yet."
                  : "No teams match your current filter."
              }
            />
          )}
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
        disabled && "cursor-not-allowed opacity-50",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
