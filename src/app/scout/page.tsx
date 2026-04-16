import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MyEventsFlow } from "@/components/MyEventsFlow";

export default function ScoutPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-16">
        <header className="mb-8 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.svg"
              alt=""
              width={40}
              height={40}
              className="shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Upcoming Events
              </h1>
              <p className="text-xs text-muted-foreground">
                Find events and scout teams you&apos;ll compete against.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
          </Button>
        </header>

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <MyEventsFlow />
        </section>
      </div>
    </main>
  );
}
