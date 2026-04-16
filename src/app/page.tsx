import Image from "next/image";
import Link from "next/link";
import { Calendar, User, ListPlus } from "lucide-react";
import { RankingsView } from "@/components/RankingsView";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.svg"
              alt="VEX Scout"
              width={40}
              height={40}
              priority
              className="shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                VEX Worlds Match Scout
              </h1>
              <p className="text-xs text-muted-foreground">
                Skills ranking from scouted data
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <NavLink href="/scout" icon={<Calendar className="h-4 w-4" />} label="Events" />
            <NavLink href="/profile" icon={<User className="h-4 w-4" />} label="My Team" />
            <NavLink href="/manual" icon={<ListPlus className="h-4 w-4" />} label="Manual" />
          </nav>
        </header>

        <RankingsView />

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          Data from RobotEvents API · Not affiliated with REC Foundation
        </footer>
      </div>
    </main>
  );
}

function NavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 hover:border-primary/30"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </Link>
  );
}
