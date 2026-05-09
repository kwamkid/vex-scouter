"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  DIVISION_OPTIONS,
  findDivision,
  type DivisionOption,
} from "@/lib/robotevents/programs";
import { SeasonSelect, pickDefaultSeasonId, useSeasons } from "./SeasonSelect";
import { RankingTable } from "./RankingTable";
import type { TeamRow } from "@/types";

const DEFAULT_DIV = findDivision("V5RC", "Middle School")!;

type RankedRow = TeamRow & { computedRank: number };

export function RankingsView() {
  const [division, setDivision] = useState<DivisionOption>(DEFAULT_DIV);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [rows, setRows] = useState<RankedRow[]>([]);
  const [search, setSearch] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [pending, start] = useTransition();

  const { seasons, loading: seasonsLoading } = useSeasons(division.program);

  useEffect(() => {
    if (seasons.length === 0) return;
    if (seasonId && seasons.some((s) => s.id === seasonId)) return;
    setSeasonId(pickDefaultSeasonId(seasons));
  }, [seasons, seasonId]);

  // Fetch rows exactly once per (league, season) change. Filtering + pagination
  // happen locally so typing in the search box feels instant.
  useEffect(() => {
    if (!seasonId) return;
    start(async () => {
      const qs = new URLSearchParams({
        program: division.program,
        grade: division.grade,
        season: String(seasonId),
      });
      const res = await fetch(`/api/rankings?${qs.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      setRows(json.rows ?? []);
    });
  }, [division, seasonId, refreshTick]);

  const seasonName = useMemo(() => {
    if (!seasonId) return "";
    return seasons.find((s) => s.id === seasonId)?.name ?? "";
  }, [seasons, seasonId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.teamNumber.toLowerCase().includes(q) ||
        (r.teamName ?? "").toLowerCase().includes(q) ||
        (r.organization ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            League
          </span>
          <select
            value={division.key}
            onChange={(e) => {
              const next = DIVISION_OPTIONS.find(
                (d) => d.key === e.target.value,
              );
              if (next) {
                setDivision(next);
                setSeasonId(null);
                setRows([]);
                setSearch("");
              }
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {DIVISION_OPTIONS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label} — {d.grade}
              </option>
            ))}
          </select>
        </label>
        <SeasonSelect
          seasons={seasons}
          value={seasonId}
          onChange={setSeasonId}
          loading={seasonsLoading}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          <Badge variant="brand" className="mr-2 text-[10px]">
            {division.label}
          </Badge>
          <span className="font-mono text-foreground">{rows.length}</span> teams
          {search && rows.length > 0 && (
            <>
              {" "}·{" "}
              <span className="font-mono text-foreground">
                {filtered.length}
              </span>{" "}
              match
            </>
          )}
          {seasonName && (
            <span className="ml-2 text-muted-foreground">
              · {seasonName.match(/(\d{4}-\d{4}.*)/)?.[1] ?? seasonName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search team # or name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshTick((t) => t + 1)}
            disabled={pending}
            title="Re-fetch rankings from the database"
            className="shrink-0"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", pending && "animate-spin")}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {pending && rows.length === 0 ? (
        <LoadingState size="md" label="Loading rankings…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            <>
              No scouted teams in database for{" "}
              <span className="font-semibold">{division.label}</span>.
            </>
          }
          description={
            <>
              Go to{" "}
              <a href="/" className="text-primary hover:underline">
                Events
              </a>{" "}
              and scout teams first.
            </>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title={`No teams match "${search}".`} />
      ) : (
        <RankingTable
          rows={filtered}
          programCode={division.program}
          seasonId={seasonId ?? undefined}
        />
      )}
    </div>
  );
}
