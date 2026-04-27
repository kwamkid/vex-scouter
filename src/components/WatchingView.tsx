"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWatchlist, type WatchedTeam } from "@/lib/watchlist";
import { findProgram } from "@/lib/robotevents/programs";
import { TeamDetailDialog } from "./TeamDetailDialog";
import type { TeamRow } from "@/types";
import type { SeasonOption } from "./SeasonSelect";

// Per-program data we resolve from the network: latest season + cached rows
// keyed by team id. Keeps the rendering map tidy.
type ProgramContext = {
  programCode: string;
  programId: number;
  season: SeasonOption | null;
  rowsByTeamId: Map<number, TeamRow>;
};

export function WatchingView() {
  const { items, remove } = useWatchlist();
  const [contexts, setContexts] = useState<Record<string, ProgramContext>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{
    row: TeamRow;
    program: string;
    seasonId?: number;
  } | null>(null);

  const grouped = useMemo(() => {
    const m = new Map<string, WatchedTeam[]>();
    for (const item of items) {
      const arr = m.get(item.program) ?? [];
      arr.push(item);
      m.set(item.program, arr);
    }
    // Sort each group by addedAt desc.
    for (const arr of m.values()) {
      arr.sort((a, b) => b.addedAt - a.addedAt);
    }
    return m;
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    if (items.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);

    (async () => {
      const next: Record<string, ProgramContext> = {};
      for (const [programCode, teams] of grouped.entries()) {
        const programDef = findProgram(programCode);
        if (!programDef) continue;

        // Most recent season for this program.
        let season: SeasonOption | null = null;
        try {
          const sRes = await fetch(
            `/api/seasons?program=${encodeURIComponent(programCode)}`,
          );
          const sJson = await sRes.json();
          const all = (sJson.seasons ?? []) as SeasonOption[];
          const now = Date.now();
          season =
            all.find((s) => {
              const st = s.start ? new Date(s.start).getTime() : 0;
              return st <= now;
            }) ??
            all[0] ??
            null;
        } catch {
          season = null;
        }

        const rowsByTeamId = new Map<number, TeamRow>();
        const ids = teams
          .map((t) => t.teamId)
          .filter((id): id is number => typeof id === "number");
        if (season && ids.length > 0) {
          try {
            const res = await fetch("/api/teams/cache-batch", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                ids,
                seasonId: season.id,
                programId: programDef.id,
              }),
            });
            const json = await res.json();
            for (const row of (json.rows ?? []) as TeamRow[]) {
              if (row.teamId != null) rowsByTeamId.set(row.teamId, row);
            }
          } catch {
            // best-effort
          }
        }

        next[programCode] = {
          programCode,
          programId: programDef.id,
          season,
          rowsByTeamId,
        };
      }
      if (!cancelled) {
        setContexts(next);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [grouped, items.length]);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <Star className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-foreground">No teams watched yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Open any team&apos;s detail and tap{" "}
          <span className="inline-flex items-baseline gap-1 font-semibold">
            <Star className="h-3 w-3 inline" /> Watch
          </span>{" "}
          to save them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {[...grouped.entries()].map(([program, teams]) => {
        const ctx = contexts[program];
        return (
          <section
            key={program}
            className="rounded-lg border border-border bg-card"
          >
            <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
              <div className="flex items-center gap-2">
                <Badge variant="brand" className="text-[10px]">
                  {program}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {teams.length} team{teams.length !== 1 ? "s" : ""}
                </span>
                {ctx?.season && (
                  <span className="text-[10px] text-muted-foreground">
                    · {shortSeason(ctx.season.name)}
                  </span>
                )}
              </div>
            </header>

            <ul className="divide-y divide-border/50">
              {teams.map((t) => {
                const cached =
                  t.teamId != null
                    ? (ctx?.rowsByTeamId.get(t.teamId) ?? null)
                    : null;
                return (
                  <WatchRow
                    key={`${program}::${t.teamNumber}`}
                    team={t}
                    cached={cached}
                    loading={loading && !cached}
                    onOpen={() => {
                      if (!cached) return;
                      setSelected({
                        row: cached,
                        program,
                        seasonId: ctx?.season?.id,
                      });
                    }}
                    onRemove={() => remove(t.teamNumber, program)}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}

      <TeamDetailDialog
        row={selected?.row ?? null}
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
        programCode={selected?.program}
        seasonId={selected?.seasonId}
      />
    </div>
  );
}

function WatchRow({
  team,
  cached,
  loading,
  onOpen,
  onRemove,
}: {
  team: WatchedTeam;
  cached: TeamRow | null;
  loading: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const clickable = !!cached;
  return (
    <li
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 transition-colors",
        clickable && "cursor-pointer hover:bg-muted/40",
      )}
      onClick={() => clickable && onOpen()}
    >
      <Star className="h-3.5 w-3.5 shrink-0 fill-brand-orange text-brand-orange" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-sm font-bold text-primary">
            {team.teamNumber}
          </span>
          <span className="truncate text-sm text-foreground">
            {cached?.teamName ?? team.teamName ?? "—"}
          </span>
        </div>
        {cached && (
          <div className="text-[11px] text-muted-foreground truncate">
            {[cached.organization, cached.country].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>

      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      ) : cached ? (
        <div className="flex shrink-0 items-center gap-3 text-[11px]">
          <Stat label="Score" value={cached.skillsScore ?? "—"} />
          <Stat label="Rank" value={cached.skillsWorldRank ?? "—"} />
          <Stat label="Awards" value={cached.awardCount || "—"} />
        </div>
      ) : (
        <span className="shrink-0 text-[10px] italic text-muted-foreground/60">
          not scouted
        </span>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remove from watchlist"
        className="shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="font-mono font-semibold text-foreground">{value}</span>
      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function shortSeason(name: string): string {
  const m = name.match(/(\d{4}-\d{4}.*)$/);
  return m ? m[1] : name;
}
