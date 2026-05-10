import { AppShell, PageHeader } from "@/components/AppShell";
import { LeaguePicker } from "@/components/LeaguePicker";

export default function HomePage() {
  return (
    <AppShell maxWidth="2xl">
      <PageHeader
        title="Pick your league"
        subtitle="Choose VEX IQ or VEX V5 to see your team's events and stats."
      />
      <LeaguePicker />
    </AppShell>
  );
}
