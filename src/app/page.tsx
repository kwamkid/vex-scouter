import { AppShell, PageHeader } from "@/components/AppShell";
import { MyEventsFlow } from "@/components/MyEventsFlow";

export default function HomePage() {
  return (
    <AppShell maxWidth="2xl">
      <PageHeader
        title="Events"
        subtitle="Find your team's upcoming, ongoing, and past events."
      />
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <MyEventsFlow />
      </section>
    </AppShell>
  );
}
