import * as React from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

/**
 * Standard empty-state card: optional icon, title, optional description, and
 * optional action area. Centered in a rounded card with muted styling.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-8 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mx-auto flex h-8 w-8 items-center justify-center text-muted-foreground/50">
          {icon}
        </div>
      )}
      <p className={cn("text-sm text-foreground", icon && "mt-3")}>{title}</p>
      {description && (
        <div className="mt-1 text-xs text-muted-foreground">{description}</div>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
