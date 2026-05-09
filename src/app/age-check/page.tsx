import { AppShell, PageHeader } from "@/components/AppShell";
import { AgeCheckView } from "@/components/AgeCheckView";

export default function AgeCheckPage() {
  return (
    <AppShell maxWidth="2xl">
      <PageHeader
        title="Age Check"
        subtitle="Check which VEX competition levels a student is eligible for, based on age at VEX Worlds."
      />
      <AgeCheckView />
    </AppShell>
  );
}
