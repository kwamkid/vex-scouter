import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamProfileView } from "@/components/TeamProfileView";

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 flex items-start justify-between gap-3 sm:mb-8">
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src="/logo.svg"
              alt=""
              width={40}
              height={40}
              className="shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight sm:text-xl">
                My Team Profile
              </h1>
              <p className="text-xs text-muted-foreground">
                Detailed season stats for your team.
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

        <TeamProfileView />
      </div>
    </main>
  );
}
