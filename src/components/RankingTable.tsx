"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Trophy,
  Medal,
  Award as AwardIcon,
  MinusCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Download,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TeamRow } from "@/types";
import {
  defaultSort,
  sortRows,
  type SortDir,
  type SortKey,
} from "@/lib/ranking/sort";
import { TeamDetailDialog } from "./TeamDetailDialog";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

const COUNTRY_FLAG: Record<string, string> = {
  Thailand: "🇹🇭",
  "United States": "🇺🇸",
  USA: "🇺🇸",
  China: "🇨🇳",
  Taiwan: "🇹🇼",
  "Hong Kong": "🇭🇰",
  "New Zealand": "🇳🇿",
  Canada: "🇨🇦",
  Mexico: "🇲🇽",
  Singapore: "🇸🇬",
  Australia: "🇦🇺",
  "United Kingdom": "🇬🇧",
  Japan: "🇯🇵",
  "Korea, Republic of": "🇰🇷",
  Vietnam: "🇻🇳",
  Malaysia: "🇲🇾",
  Indonesia: "🇮🇩",
  Philippines: "🇵🇭",
  India: "🇮🇳",
};

function flag(country: string | null): string {
  if (!country) return "";
  return COUNTRY_FLAG[country] ?? "🏳️";
}

function tierBadge(tier: number, topAward: string | null) {
  if (tier === 0 || !topAward) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (tier === 1)
    return (
      <Badge variant="gold">
        <Trophy className="h-3 w-3" />
        <span className="truncate max-w-40">{topAward}</span>
      </Badge>
    );
  if (tier === 2)
    return (
      <Badge variant="silver">
        <Medal className="h-3 w-3" />
        <span className="truncate max-w-40">{topAward}</span>
      </Badge>
    );
  if (tier === 3)
    return (
      <Badge variant="bronze">
        <Medal className="h-3 w-3" />
        <span className="truncate max-w-40">{topAward}</span>
      </Badge>
    );
  return (
    <Badge variant="outline">
      <AwardIcon className="h-3 w-3" />
      <span className="truncate max-w-40">{topAward}</span>
    </Badge>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 uppercase text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors",
        active && "text-primary",
        className,
      )}
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

type SortState = { key: SortKey | null; dir: SortDir };

export function RankingTable({
  rows,
  programCode,
  highlightTeam,
  onRowExpand,
  onForceRefresh,
  scoutingIds,
  failedIds,
  seasonId,
  externalPaging,
}: {
  rows: TeamRow[];
  programCode?: string;
  highlightTeam?: string;
  onRowExpand?: (teamId: number) => Promise<TeamRow | null> | void;
  onForceRefresh?: (teamId: number) => Promise<TeamRow | null> | void;
  scoutingIds?: Set<number>;
  failedIds?: Set<number>;
  seasonId?: number;
  /**
   * When set, pagination is driven by the parent:
   *   - `startIndex` is used as the offset for row numbering (so rank column
   *     continues from the server-side page).
   *   - Internal Prev/Next/page-size controls are hidden; rows are rendered as-is.
   */
  externalPaging?: { startIndex: number };
}) {
  const highlight = highlightTeam?.toUpperCase();

  function handleSelect(row: TeamRow) {
    if (row.notFound) return;
    setSelected(row);
    if (onRowExpand && row.teamId != null) {
      void Promise.resolve(onRowExpand(row.teamId)).then((fresh) => {
        if (fresh) setSelected(fresh);
      });
    }
  }
  const [sort, setSort] = useState<SortState>({ key: null, dir: "asc" });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSizeOption>(25);
  const [selected, setSelected] = useState<TeamRow | null>(null);

  const sorted = useMemo(() => {
    if (!sort.key) return defaultSort(rows);
    return sortRows(rows, sort.key, sort.dir);
  }, [rows, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const internalStart = safePage * pageSize;
  const start = externalPaging ? externalPaging.startIndex : internalStart;
  const pageRows = externalPaging
    ? sorted
    : sorted.slice(internalStart, internalStart + pageSize);

  function onSort(key: SortKey, defaultDir: SortDir = "asc") {
    setSort((s) => {
      if (s.key !== key) return { key, dir: defaultDir };
      // Second click: flip direction. Third click: reset.
      const flipped = s.dir === "asc" ? "desc" : "asc";
      if (flipped !== defaultDir) return { key, dir: flipped };
      return { key: null, dir: "asc" };
    });
    setPage(0);
  }

  function exportCSV() {
    const headers = [
      "Team",
      "Name",
      "Organization",
      "Country",
      "Skills Rank",
      "Skills Score",
      "Prog",
      "Driver",
      "Awards",
      "Top Award",
      "Best Event Rank",
    ];
    const csvRows = [headers.join(",")];
    for (const r of sorted) {
      csvRows.push(
        [
          r.teamNumber,
          esc(r.teamName),
          esc(r.organization),
          esc(r.country),
          r.skillsWorldRank ?? "",
          r.skillsScore ?? "",
          r.progScore ?? "",
          r.driverScore ?? "",
          r.awardCount,
          esc(r.topAward),
          r.bestEventRank ?? "",
        ].join(","),
      );
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vex-scout-${sorted.length}-teams.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Desktop: table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Org / Country</TableHead>
              <TableHead title="Best skills rank the team has achieved at any event this season (event-local rank — RobotEvents API does not expose a world rank)">
                <SortHeader
                  label="Skills Rank"
                  active={sort.key === "skillsWorldRank"}
                  dir={sort.dir}
                  onClick={() => onSort("skillsWorldRank", "asc")}
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  label="Score"
                  active={sort.key === "skillsScore"}
                  dir={sort.dir}
                  onClick={() => onSort("skillsScore", "desc")}
                />
              </TableHead>
              <TableHead>Prog / Driver</TableHead>
              <TableHead>
                <SortHeader
                  label="Awards"
                  active={sort.key === "awardCount"}
                  dir={sort.dir}
                  onClick={() => onSort("awardCount", "desc")}
                />
              </TableHead>
              <TableHead>Top Award</TableHead>
              <TableHead title="Best event rank — lowest finishing position across this season's events">
                <SortHeader
                  label="Best Event Rank"
                  active={sort.key === "bestEventRank"}
                  dir={sort.dir}
                  onClick={() => onSort("bestEventRank", "asc")}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row, i) => (
              <motion.tr
                key={row.teamNumber}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                onClick={() => handleSelect(row)}
                className={cn(
                  "border-b border-border transition-colors",
                  !row.notFound && "cursor-pointer hover:bg-muted/50",
                  row.notFound && "bg-muted/40 text-muted-foreground",
                  row.hasExcellence && "ring-1 ring-inset ring-tier-gold/50",
                  !row.notFound &&
                    row.skillsWorldRank !== null &&
                    row.skillsWorldRank <= 50 &&
                    "bg-primary/5",
                  highlight &&
                    row.teamNumber.toUpperCase() === highlight &&
                    "bg-primary/10 ring-2 ring-inset ring-primary/60",
                )}
              >
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {start + i + 1}
                </TableCell>

                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-mono font-bold text-foreground inline-flex items-center gap-1.5">
                      {row.teamNumber}
                      {row.teamId != null && scoutingIds?.has(row.teamId) && (
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      )}
                      {row.teamId != null && failedIds?.has(row.teamId) && (
                        <span className="text-[10px] text-destructive">!</span>
                      )}
                    </span>
                    {row.teamName && (
                      <span className="text-xs text-muted-foreground">
                        {row.teamName}
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  {row.notFound ? (
                    <Badge variant="muted">
                      <MinusCircle className="h-3 w-3" /> Not in RE
                    </Badge>
                  ) : (
                    <div className="flex flex-col text-xs">
                      {row.organization && (
                        <span className="text-foreground truncate max-w-55">
                          {row.organization}
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        {flag(row.country)}{" "}
                        {[row.city, row.region, row.country]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </TableCell>

                <TableCell className="font-mono">
                  {row.skillsWorldRank ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell className="font-mono font-semibold text-primary">
                  {row.skillsScore ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell className="font-mono text-xs text-muted-foreground">
                  {row.progScore !== null || row.driverScore !== null
                    ? `${row.progScore ?? 0} / ${row.driverScore ?? 0}`
                    : "—"}
                </TableCell>

                <TableCell className="font-mono">
                  {row.awardCount > 0 ? (
                    <Badge
                      variant={
                        row.awardTier === 1
                          ? "gold"
                          : row.awardTier === 2
                            ? "silver"
                            : row.awardTier === 3
                              ? "bronze"
                              : "outline"
                      }
                    >
                      {row.awardCount}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell>{tierBadge(row.awardTier, row.topAward)}</TableCell>

                <TableCell className="font-mono">
                  {row.bestEventRank ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: card stack */}
      <ul className="flex flex-col gap-2 md:hidden">
        {pageRows.map((row, i) => (
          <motion.li
            key={row.teamNumber}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.2 }}
            onClick={() => handleSelect(row)}
            className={cn(
              "rounded-lg border border-border bg-card p-3 transition-colors",
              !row.notFound && "cursor-pointer active:bg-muted/60",
              row.notFound && "bg-muted/40 text-muted-foreground",
              row.hasExcellence && "ring-1 ring-tier-gold/50",
              !row.notFound &&
                row.skillsWorldRank !== null &&
                row.skillsWorldRank <= 50 &&
                "bg-primary/5",
              highlight &&
                row.teamNumber.toUpperCase() === highlight &&
                "ring-2 ring-primary/60 bg-primary/10",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    #{start + i + 1}
                  </span>
                  <span className="font-mono text-base font-bold text-foreground">
                    {row.teamNumber}
                  </span>
                  {row.teamId != null && scoutingIds?.has(row.teamId) && (
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  )}
                  {row.teamId != null && failedIds?.has(row.teamId) && (
                    <span className="text-[10px] text-destructive">!</span>
                  )}
                  {row.notFound && (
                    <Badge variant="muted" className="text-[10px]">
                      Not in RE
                    </Badge>
                  )}
                </div>
                {row.teamName && (
                  <div className="text-xs text-muted-foreground truncate">
                    {row.teamName}
                  </div>
                )}
                {!row.notFound && (
                  <div className="mt-1 text-[11px] text-muted-foreground truncate">
                    {flag(row.country)}{" "}
                    {[row.organization, row.country].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              {!row.notFound && (
                <div className="text-right shrink-0">
                  <div className="font-mono text-lg font-semibold text-primary leading-none">
                    {row.skillsScore ?? "—"}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                    skills score
                  </div>
                </div>
              )}
            </div>

            {!row.notFound && (
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <Stat
                  label="Sk. Rank"
                  value={row.skillsWorldRank ?? "—"}
                />
                <Stat
                  label="Prog/Drv"
                  value={
                    row.progScore !== null || row.driverScore !== null
                      ? `${row.progScore ?? 0}/${row.driverScore ?? 0}`
                      : "—"
                  }
                  small
                />
                <Stat
                  label="Awards"
                  value={row.awardCount > 0 ? row.awardCount : "—"}
                />
                <Stat
                  label="Best"
                  value={row.bestEventRank ?? "—"}
                />
              </div>
            )}

            {!row.notFound && row.topAward && (
              <div className="mt-2">{tierBadge(row.awardTier, row.topAward)}</div>
            )}
          </motion.li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col items-center gap-3 text-xs text-muted-foreground sm:flex-row sm:justify-between">
        {!externalPaging && sorted.length > PAGE_SIZE_OPTIONS[0] ? (
          <div className="flex items-center gap-3">
            <span>
              Showing{" "}
              <span className="font-mono text-foreground">
                {start + 1}–{Math.min(start + pageSize, sorted.length)}
              </span>{" "}
              of{" "}
              <span className="font-mono text-foreground">{sorted.length}</span>
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as PageSizeOption);
                setPage(0);
              }}
              className="h-7 rounded border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        ) : externalPaging ? (
          <span />
        ) : (
          <span>{sorted.length} teams</span>
        )}
        <div className="flex items-center gap-2">
          {!externalPaging && sorted.length > PAGE_SIZE_OPTIONS[0] && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Prev</span>
              </Button>
              <span className="font-mono">
                {safePage + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      <TeamDetailDialog
        row={selected}
        open={selected !== null}
        programCode={programCode}
        seasonId={seasonId}
        onForceRefresh={onForceRefresh ? (id) => {
          void Promise.resolve(onForceRefresh(id)).then((fresh) => {
            if (fresh && typeof fresh === "object" && "teamNumber" in fresh) {
              setSelected(fresh as TeamRow);
            }
          });
        } : undefined}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      />
    </>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: React.ReactNode;
  small?: boolean;
}) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div
        className={cn(
          "font-mono font-semibold text-foreground",
          small ? "text-xs" : "text-sm",
        )}
      >
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function esc(v: string | null | undefined): string {
  if (!v) return "";
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
