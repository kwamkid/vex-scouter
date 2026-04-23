import { AppShell, PageHeader } from "@/components/AppShell";
import { RankingsView } from "@/components/RankingsView";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <AppShell maxWidth="7xl">
      <PageHeader
        title="Rankings"
        subtitle="Skills ranking aggregated from scouted teams."
      />
      <RankingsView />
    </AppShell>
  );
}
