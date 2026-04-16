import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-foreground",
        gold: "border-tier-gold/60 bg-tier-gold/10 text-tier-gold",
        silver: "border-tier-silver/60 bg-tier-silver/10 text-tier-silver",
        bronze: "border-tier-bronze/60 bg-tier-bronze/10 text-tier-bronze",
        muted: "border-border bg-muted/60 text-muted-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        brand: "border-primary/30 bg-primary/10 text-primary",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
