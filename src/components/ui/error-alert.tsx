import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ErrorAlertProps = {
  message: React.ReactNode;
  /**
   * sm: tight inline (text-[11px], px-2/3, h-3.5 icon).
   * md: block-level (text-xs, p-3, h-4 icon).
   */
  size?: "sm" | "md";
  className?: string;
};

const SIZES = {
  sm: {
    box: "rounded-md px-3 py-2 text-[11px]",
    icon: "h-3.5 w-3.5",
  },
  md: {
    box: "rounded-lg p-3 text-xs",
    icon: "h-4 w-4",
  },
} as const;

/**
 * Standard inline error banner. Use anywhere an async load failed and we want
 * to show the message in-context (vs. throwing a global error).
 */
export function ErrorAlert({
  message,
  size = "sm",
  className,
}: ErrorAlertProps) {
  const s = SIZES[size];
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 border border-destructive/30 bg-destructive/5 text-destructive",
        s.box,
        className,
      )}
    >
      <AlertTriangle className={cn("shrink-0 mt-0.5", s.icon)} />
      <span className="min-w-0 break-all">{message}</span>
    </div>
  );
}
