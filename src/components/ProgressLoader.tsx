"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Reusable progress indicator. Drives a real bar from a 0..100 percent and a
// short text label. Use it for any streaming/chunked operation that wants to
// show "real" progress (not a spinner).
export function ProgressLoader({
  percent,
  label,
  className,
  fromCache,
}: {
  percent: number;
  label: string;
  className?: string;
  /** Show a small "from cache" badge — tells the user why it was fast. */
  fromCache?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3 sm:p-4",
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        {clamped < 100 && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-orange" />
        )}
        <span className="flex-1 truncate">{label}</span>
        {fromCache && (
          <span className="rounded-sm border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            Cached
          </span>
        )}
        <span className="font-mono tabular-nums text-foreground">
          {Math.round(clamped)}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-linear-to-r from-brand-orange to-primary transition-[width] duration-200 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
