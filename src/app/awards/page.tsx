import { AppShell, PageHeader } from "@/components/AppShell";
import { AwardsCompareView } from "@/components/AwardsCompareView";

export default function AwardsPage() {
  return (
    <AppShell maxWidth="7xl">
      <PageHeader
        title="Compare Awards"
        subtitle="Add multiple teams to see their awards side by side for one season."
      />
      <AwardsCompareView />
    </AppShell>
  );
}
