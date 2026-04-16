"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseTeamInput } from "@/lib/parse/team-input";
import {
  DIVISION_OPTIONS,
  findDivision,
  type DivisionOption,
  type GradeLevel,
  type ProgramCode,
} from "@/lib/robotevents/programs";

const SAMPLE = `2989A
12345B
67890C
99999D`;

const STORAGE_KEY = "vex-scout:program-grade";
const DEFAULT_DIVISION = findDivision("V5RC", "Middle School")!;

export function ManualInput() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [division, setDivision] = useState<DivisionOption>(DEFAULT_DIVISION);
  const [isPending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          program?: ProgramCode;
          grade?: GradeLevel;
        };
        if (saved.program && saved.grade) {
          const d = findDivision(saved.program, saved.grade);
          if (d) setDivision(d);
        }
      }
    } catch {
      // ignore malformed localStorage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ program: division.program, grade: division.grade }),
      );
    } catch {
      // ignore quota / privacy errors
    }
  }, [division, hydrated]);

  const parsed = parseTeamInput(value);
  const canSubmit = parsed.length >= 2;

  function handleSubmit() {
    if (!canSubmit) return;
    const qs = new URLSearchParams({
      teams: parsed.join(","),
      program: division.program,
      grade: division.grade,
    });
    startTransition(() => {
      router.push(`/manual?${qs.toString()}`);
    });
  }

  return (
    <div className="w-full space-y-4">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Division
        </span>
        <select
          value={division.key}
          onChange={(e) => {
            const next = DIVISION_OPTIONS.find((d) => d.key === e.target.value);
            if (next) setDivision(next);
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

      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={SAMPLE}
        spellCheck={false}
        autoFocus
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSubmit();
        }}
      />

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {parsed.length === 0 ? (
            <span>Paste team numbers — one per line</span>
          ) : (
            <span>
              <span className="text-primary font-mono font-semibold">
                {parsed.length}
              </span>{" "}
              team{parsed.length !== 1 ? "s" : ""} detected
              {parsed.length >= 1 && (
                <span className="ml-2 font-mono text-muted-foreground/70 hidden sm:inline">
                  {parsed.slice(0, 6).join(", ")}
                  {parsed.length > 6 ? "…" : ""}
                </span>
              )}
            </span>
          )}
        </div>

        <Button onClick={handleSubmit} disabled={!canSubmit || isPending} size="lg">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </>
          ) : (
            <>
              Compare <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: copy directly from an Excel column. ⌘/Ctrl + Enter to submit.
      </p>
    </div>
  );
}
