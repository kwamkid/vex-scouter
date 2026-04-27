"use client";

import { useEffect, useState, useCallback } from "react";

export type WatchedTeam = {
  teamId: number | null;
  teamNumber: string;
  teamName: string | null;
  program: string;
  addedAt: number;
};

const STORAGE_KEY = "vex-scout:watchlist";

function read(): WatchedTeam[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is WatchedTeam =>
        e &&
        typeof e === "object" &&
        typeof e.teamNumber === "string" &&
        typeof e.program === "string",
    );
  } catch {
    return [];
  }
}

function write(items: WatchedTeam[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    // Notify other instances of the hook in the same tab.
    window.dispatchEvent(new CustomEvent("vex-scout:watchlist-changed"));
  } catch {
    // ignore quota / privacy errors
  }
}

function makeKey(teamNumber: string, program: string): string {
  return `${program.toUpperCase()}::${teamNumber.toUpperCase()}`;
}

// Subscribe a component to the current watchlist. Updates when this tab or
// another tab mutates localStorage.
export type WatchInput = {
  teamId: number | null;
  teamNumber: string;
  teamName?: string | null;
  program: string;
};

export function useWatchlist(): {
  items: WatchedTeam[];
  has: (teamNumber: string, program: string) => boolean;
  toggle: (team: WatchInput) => void;
  remove: (teamNumber: string, program: string) => void;
} {
  const [items, setItems] = useState<WatchedTeam[]>(() => read());

  useEffect(() => {
    const onChange = () => setItems(read());
    window.addEventListener("storage", onChange);
    window.addEventListener("vex-scout:watchlist-changed", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("vex-scout:watchlist-changed", onChange);
    };
  }, []);

  const has = useCallback(
    (teamNumber: string, program: string) => {
      const k = makeKey(teamNumber, program);
      return items.some((e) => makeKey(e.teamNumber, e.program) === k);
    },
    [items],
  );

  const toggle = useCallback((team: WatchInput) => {
    const k = makeKey(team.teamNumber, team.program);
    const cur = read();
    const exists = cur.some((e) => makeKey(e.teamNumber, e.program) === k);
    const next = exists
      ? cur.filter((e) => makeKey(e.teamNumber, e.program) !== k)
      : [
          ...cur,
          {
            teamId: team.teamId,
            teamNumber: team.teamNumber.toUpperCase(),
            teamName: team.teamName ?? null,
            program: team.program.toUpperCase(),
            addedAt: Date.now(),
          },
        ];
    write(next);
    setItems(next);
  }, []);

  const remove = useCallback((teamNumber: string, program: string) => {
    const k = makeKey(teamNumber, program);
    const next = read().filter((e) => makeKey(e.teamNumber, e.program) !== k);
    write(next);
    setItems(next);
  }, []);

  return { items, has, toggle, remove };
}
