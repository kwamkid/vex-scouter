"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshTeamsCache } from "@/app/actions";

export function RefreshButton({ teamIds }: { teamIds: number[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        start(async () => {
          await refreshTeamsCache(teamIds);
          router.refresh();
        });
      }}
    >
      <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      {pending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
