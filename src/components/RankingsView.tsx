"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DIVISION_OPTIONS,
  findDivision,
  findProgram,
  type DivisionOption,
} from "@/lib/robotevents/programs";
import { SeasonSelect, pickDefaultSeasonId, useSeasons } from "./SeasonSelect";
import type { TeamRow } from "@/types";
import { countryFlag } from "@/lib/country-flags";

const DEFAULT_DIV = findDivision("V5RC", "Middle School")!;

type RankedRow = TeamRow & { computedRank: number };

export function RankingsView() {
  const [division, setDivision] = useState<DivisionOption>(DEFAULT_DIV);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [rows, setRows] = useState<RankedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [seasonName, setSeasonName] = useState("");
  const [pending, start] = useTransition();

  const { seasons, loading: seasonsLoading } = useSeasons(division.program);

  useEffect(() => {
    if (seasons.length === 0) return;
    if (seasonId && seasons.some((s) => s.id === seasonId)) return;
    setSeasonId(pickDefaultSeasonId(seasons));
  }, [seasons, seasonId]);

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
      setTotal(json.total ?? 0);
      setSeasonName(json.seasonName ?? "");
    });
  }, [division, seasonId]);

  function exportCSV() {
    const headers = ["Rank", "Team", "Name", "Org", "Country", "Skills Score", "Prog", "Driver", "Awards", "Top Award", "Best Event Rank"];
    const csvRows = [headers.join(",")];
    for (const r of rows) {
      csvRows.push([
        r.computedRank,
        r.teamNumber,
        esc(r.teamName),
        esc(r.organization),
        esc(r.country),
        r.skillsScore ?? "",
        r.progScore ?? "",
        r.driverScore ?? "",
        r.awardCount,
        esc(r.topAward),
        r.bestEventRank ?? "",
      ].join(","));
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vex-rankings-${division.label}-${total}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Division
          </span>
          <select
            value={division.key}
            onChange={(e) => {
              const next = DIVISION_OPTIONS.find((d) => d.key === e.target.value);
              if (next) {
                setDivision(next);
                setSeasonId(null);
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

      {pending ? (
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
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
            <div>
              <Badge variant="brand" className="mr-2 text-[10px]">
                {division.label}
              </Badge>
              <span className="font-mono text-foreground">{total}</span> teams
              {seasonName && (
                <span className="ml-2 text-muted-foreground">
                  · {seasonName.match(/(\d{4}-\d{4}.*)/)?.[1] ?? seasonName}
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground w-16">
                    Rank
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">
                    Team
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">
                    Org / Country
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">
                    Score
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">
                    Prog
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">
                    Driver
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">
                    Awards
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.teamNumber}
                    className="border-b border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 py-2 font-mono text-primary font-semibold">
                      #{r.computedRank}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-mono font-bold">{r.teamNumber}</div>
                      {r.teamName && (
                        <div className="text-xs text-muted-foreground truncate max-w-40">
                          {r.teamName}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      <div className="truncate max-w-52">{r.organization}</div>
                      <div>
                        {countryFlag(r.country)} {r.country}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-primary">
                      {r.skillsScore ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      {r.progScore ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      {r.driverScore ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.awardCount || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((r) => (
              <li
                key={r.teamNumber}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-primary font-semibold">
                        #{r.computedRank}
                      </span>
                      <span className="font-mono text-base font-bold">
                        {r.teamNumber}
                      </span>
                    </div>
                    {r.teamName && (
                      <div className="text-xs text-muted-foreground truncate">
                        {r.teamName}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-muted-foreground truncate">
                      {countryFlag(r.country)} {r.organization ?? r.country}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-lg font-semibold text-primary leading-none">
                      {r.skillsScore ?? "—"}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                      {r.progScore ?? 0} / {r.driverScore ?? 0}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function esc(v: string | null | undefined): string {
  if (!v) return "";
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
