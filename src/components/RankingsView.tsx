"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DIVISION_OPTIONS,
  findDivision,
  type DivisionOption,
} from "@/lib/robotevents/programs";
import { SeasonSelect, pickDefaultSeasonId, useSeasons } from "./SeasonSelect";
import { RankingTable } from "./RankingTable";
import type { TeamRow } from "@/types";

const DEFAULT_DIV = findDivision("V5RC", "Middle School")!;
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export function RankingsView() {
  const [division, setDivision] = useState<DivisionOption>(DEFAULT_DIV);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [total, setTotal] = useState(0);
  const [seasonName, setSeasonName] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [pending, start] = useTransition();

  const { seasons, loading: seasonsLoading } = useSeasons(division.program);

  useEffect(() => {
    if (seasons.length === 0) return;
    if (seasonId && seasons.some((s) => s.id === seasonId)) return;
    setSeasonId(pickDefaultSeasonId(seasons));
  }, [seasons, seasonId]);

  // Debounce the search input so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Whenever the query (division/season/search/pageSize) changes, jump back to page 1.
  useEffect(() => {
    setPage(1);
  }, [division, seasonId, debouncedSearch, pageSize]);

  useEffect(() => {
    if (!seasonId) return;
    start(async () => {
      const qs = new URLSearchParams({
        program: division.program,
        grade: division.grade,
        season: String(seasonId),
        page: String(page),
        pageSize: String(pageSize),
      });
      if (debouncedSearch) qs.set("q", debouncedSearch);
      const res = await fetch(`/api/rankings?${qs.toString()}`);
      const json = await res.json();
      setRows(json.rows ?? []);
      setTotal(json.total ?? 0);
      setSeasonName(json.seasonName ?? "");
    });
  }, [division, seasonId, debouncedSearch, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (page - 1) * pageSize;

  const rangeLabel = useMemo(() => {
    if (total === 0) return "0";
    const end = Math.min(startIndex + rows.length, total);
    return `${startIndex + 1}–${end}`;
  }, [startIndex, rows.length, total]);

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
                setTotal(0);
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
          {total > 0 ? (
            <>
              <span className="font-mono text-foreground">{rangeLabel}</span> of{" "}
              <span className="font-mono text-foreground">{total}</span>
            </>
          ) : (
            <span className="font-mono text-foreground">0</span>
          )}{" "}
          teams
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
      ) : total === 0 && !debouncedSearch ? (
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
      ) : total === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No teams match &quot;{debouncedSearch}&quot;.
        </div>
      ) : (
        <>
          <div
            className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}
          >
            <RankingTable
              rows={rows}
              programCode={division.program}
              seasonId={seasonId ?? undefined}
              externalPaging={{ startIndex }}
            />
          </div>

          <div className="flex flex-col items-center gap-3 text-xs text-muted-foreground sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
                className="h-8 rounded border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || pending}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Prev</span>
              </Button>
              <span className="font-mono">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || pending}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
