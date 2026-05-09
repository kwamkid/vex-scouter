import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "./tooltip";

type StatProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  /**
   * Wrap in a muted-pill container. Used in dense list rows where the value
   * (a number) is the primary info; label sits underneath in small caps.
   */
  pill?: boolean;
  /** Tooltip explaining what the stat means; shows an info icon on the label. */
  tooltip?: string;
  /** Slightly smaller value text — fits tighter pills. */
  small?: boolean;
  /** Override value styling (e.g. color, alignment). */
  valueClassName?: string;
  className?: string;
};

/**
 * Standard label/value display used in stat grids, dense rows, and pill
 * displays. Two layouts:
 * - default: label on top (uppercase small), value below (mono).
 * - pill: muted bg container; value on top (mono), label below (smaller caps).
 */
export function Stat({
  label,
  value,
  pill = false,
  tooltip,
  small = false,
  valueClassName,
  className,
}: StatProps) {
  const labelEl = (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
      {label}
      {tooltip && <Info className="h-2.5 w-2.5 opacity-60" />}
    </span>
  );
  const labelNode = tooltip ? (
    <InfoTooltip content={tooltip}>{labelEl}</InfoTooltip>
  ) : (
    labelEl
  );

  const valueEl = (
    <span
      className={cn(
        "font-mono font-semibold text-foreground",
        small ? "text-xs" : "text-sm",
        valueClassName,
      )}
    >
      {value}
    </span>
  );

  if (pill) {
    return (
      <div className={cn("rounded-md bg-muted/40 px-2 py-1.5", className)}>
        {valueEl}
        <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {labelNode}
      {valueEl}
    </div>
  );
}
