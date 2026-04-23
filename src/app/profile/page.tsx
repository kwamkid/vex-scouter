import { AppShell, PageHeader } from "@/components/AppShell";
import { TeamProfileView } from "@/components/TeamProfileView";

export default function ProfilePage() {
  return (
    <AppShell maxWidth="3xl">
      <PageHeader
        title="My Team Profile"
        subtitle="Detailed season stats for your team."
      />
      <TeamProfileView />
    </AppShell>
  );
}
