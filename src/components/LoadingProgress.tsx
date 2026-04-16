"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const PHASES = [
  { at: 0, label: "Looking up teams on RobotEvents…" },
  { at: 15, label: "Fetching awards and rankings…" },
  { at: 45, label: "Computing skills scores…" },
  { at: 75, label: "Aggregating results…" },
  { at: 92, label: "Almost there…" },
];

export function LoadingProgress() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(PHASES[0].label);

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const fast = 90 * (1 - Math.exp(-elapsed / 9));
      const creep = Math.max(0, elapsed - 20) * 0.25;
      const target = Math.min(99, fast + creep);
      setProgress(target);

      const current = [...PHASES].reverse().find((p) => target >= p.at);
      if (current) setPhase(current.label);
    }, 150);
    return () => clearInterval(tick);
  }, []);

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        <span className="text-sm text-foreground truncate">{phase}</span>
        <span className="ml-auto font-mono text-xs text-muted-foreground shrink-0">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full bg-primary"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Fetching from RobotEvents API — first load can take 20–40s for large
        lists, subsequent loads use cache.
      </p>
    </div>
  );
}
