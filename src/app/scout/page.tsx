import { AppShell, PageHeader } from "@/components/AppShell";
import { MyEventsFlow } from "@/components/MyEventsFlow";

export default function ScoutPage() {
  return (
    <AppShell maxWidth="2xl">
      <PageHeader
        title="Upcoming Events"
        subtitle="Find events and scout teams you'll compete against."
      />
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <MyEventsFlow />
      </section>
    </AppShell>
  );
}
