"use client";

import { useEffect, useState } from "react";

export type SeasonOption = {
  id: number;
  name: string;
  start?: string | null;
};

export function useSeasons(programCode: string) {
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/seasons?program=${encodeURIComponent(programCode)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setSeasons(
          (json.seasons ?? []).map((s: SeasonOption) => ({
            id: s.id,
            name: s.name,
            start: s.start ?? null,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setSeasons([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [programCode]);

  return { seasons, loading };
}

// Pick the default season = the most recent that has already started.
// `seasons` comes back from the API with one leading "future" season, so we
// skip any that starts after "now".
export function pickDefaultSeasonId(seasons: SeasonOption[]): number | null {
  if (!seasons.length) return null;
  const now = Date.now();
  const started = seasons.find((s) => {
    const start = s.start ? new Date(s.start).getTime() : 0;
    return start <= now;
  });
  return (started ?? seasons[0]).id;
}

export function SeasonSelect({
  seasons,
  value,
  onChange,
  loading,
}: {
  seasons: SeasonOption[];
  value: number | null;
  onChange: (id: number) => void;
  loading: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Season
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={loading || seasons.length === 0}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {loading && <option>Loading…</option>}
        {!loading &&
          seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {shortSeason(s.name)}
            </option>
          ))}
      </select>
    </label>
  );
}

// Strip the verbose program prefix so the game name stays visible:
//   "VEX V5 Robotics Competition 2025-2026: Push Back" → "2025-2026: Push Back"
//   "VRC 2023-2024: Over Under"                         → "2023-2024: Over Under"
// Anything without a YYYY-YYYY token falls back to the original name.
function shortSeason(name: string): string {
  const match = name.match(/(\d{4}-\d{4}.*)$/);
  return match ? match[1] : name;
}
