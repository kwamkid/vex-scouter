import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { MyEventsFlow } from "@/components/MyEventsFlow";
import {
  isLeague,
  LEAGUE_LABEL,
  LEAGUE_PROGRAM,
  LEAGUE_TAGLINE,
} from "@/lib/league";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league } = await params;
  if (!isLeague(league)) notFound();

  return (
    <AppShell maxWidth="2xl">
      <Link
        href="/"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to league selection
      </Link>
      <PageHeader
        title={`${LEAGUE_LABEL[league]} Events`}
        subtitle={`${LEAGUE_TAGLINE[league]} — find your team's upcoming, ongoing, and past events.`}
      />
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <MyEventsFlow lockedProgram={LEAGUE_PROGRAM[league]} />
      </section>
    </AppShell>
  );
}
