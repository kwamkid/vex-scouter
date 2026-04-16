import Image from "next/image";
import Link from "next/link";
import { ListPlus } from "lucide-react";
import { MyEventsFlow } from "@/components/MyEventsFlow";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-16">
        <header className="mb-8 flex items-center gap-3 sm:mb-10">
          <Image
            src="/logo.svg"
            alt="VEX Scout"
            width={40}
            height={40}
            priority
            className="shrink-0 sm:h-12 sm:w-12"
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              VEX Worlds Match Scout
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Find your upcoming events and scout the teams you&apos;ll face.
            </p>
          </div>
        </header>

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Your upcoming events
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Enter your team number — we&apos;ll list every event you&apos;re
            registered for that hasn&apos;t finished yet. Tap an event to scout
            the teams you&apos;ll compete against.
          </p>
          <MyEventsFlow />
        </section>

        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <ListPlus className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">
                Manual compare
              </div>
              <p className="text-xs text-muted-foreground">
                Paste a list of team numbers to compare directly, without
                selecting an event.
              </p>
            </div>
            <Link
              href="/manual"
              className="self-center text-sm font-medium text-primary hover:underline shrink-0"
            >
              Open →
            </Link>
          </div>
        </div>

        <footer className="mt-8 text-center text-xs text-muted-foreground">
          Data from RobotEvents API · Not affiliated with REC Foundation
        </footer>
      </div>
    </main>
  );
}
