import { AppShell, PageHeader } from "@/components/AppShell";
import { WatchingView } from "@/components/WatchingView";

export const dynamic = "force-dynamic";

export default function WatchingPage() {
  return (
    <AppShell maxWidth="5xl">
      <PageHeader
        title="Watching"
        subtitle="Teams you've starred — quick access to their season stats."
      />
      <WatchingView />
    </AppShell>
  );
}
