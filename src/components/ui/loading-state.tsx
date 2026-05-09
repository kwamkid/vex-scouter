import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  label?: React.ReactNode;
  /**
   * sm: tight inline spinner (h-3.5 + text-xs). Use inside cards / sections.
   * md: large centered (h-5 + text-base + py-12). Use as a page placeholder.
   */
  size?: "sm" | "md";
  className?: string;
};

/**
 * Standard inline loading indicator: spinner + optional label.
 */
export function LoadingState({
  label = "Loading…",
  size = "sm",
  className,
}: LoadingStateProps) {
  if (size === "md") {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 py-12 text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        {label}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {label}
    </div>
  );
}
