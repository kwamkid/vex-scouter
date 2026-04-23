"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
      const res = await fetch(`/api/rankings?${qs.toString()}`);
      const json = await res.json();
      setRows(json.rows ?? []);
    });
  }, [division, seasonId]);

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
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search team # or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {pending && rows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading rankings…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No scouted teams in database for{" "}
            <span className="font-semibold">{division.label}</span>.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Go to{" "}
            <a href="/scout" className="text-primary hover:underline">
              Upcoming Events
            </a>{" "}
            and scout teams first.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No teams match &quot;{search}&quot;.
        </div>
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
