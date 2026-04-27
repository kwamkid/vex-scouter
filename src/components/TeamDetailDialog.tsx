"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  Medal,
  Award as AwardIcon,
  Calendar,
  MapPin,
  Building2,
  ChevronRight,
  Loader2,
  RefreshCw,
  Star,
  Target,
} from "lucide-react";
import { useWatchlist } from "@/lib/watchlist";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TeamMatchHistory, type TeamInfoMap } from "./TeamMatchHistory";
import type { TeamRow } from "@/types";
import type { Award, Ranking, EventRef, Skill } from "@/lib/robotevents/schemas";

function awardTierFor(title: string): {
  tier: number;
  icon: React.ReactNode;
  variant: "gold" | "silver" | "bronze" | "outline";
} {
  if (/excellence/i.test(title))
    return { tier: 1, icon: <Trophy className="h-3.5 w-3.5" />, variant: "gold" };
  if (/tournament champion/i.test(title))
    return { tier: 2, icon: <Medal className="h-3.5 w-3.5" />, variant: "silver" };
  if (/tournament finalist/i.test(title))
    return { tier: 3, icon: <Medal className="h-3.5 w-3.5" />, variant: "bronze" };
  return { tier: 4, icon: <AwardIcon className="h-3.5 w-3.5" />, variant: "outline" };
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

type TabKey = "event" | "events" | "awards" | "skills";

export function TeamDetailDialog({
  row,
  open,
  onOpenChange,
  programCode,
  seasonId,
  eventId,
  eventTeamNames,
  onForceRefresh,
}: {
  row: TeamRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programCode?: string;
  seasonId?: number;
  /** When set, an extra tab shows the team's matches at this specific event. */
  eventId?: number;
  /** Team roster for the event, used to render full names in match cards. */
  eventTeamNames?: TeamInfoMap;
  onForceRefresh?: (teamId: number) => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<EventRef[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchlist = useWatchlist();
  // Default to the event tab when we're in an event context, otherwise jump
  // straight to "Events" — that's the most common entry point from Watching.
  const [tab, setTab] = useState<TabKey>(eventId ? "event" : "events");

  // Reset the active tab whenever the dialog is opened for a different team /
  // context so stale state doesn't leak between rows.
  useEffect(() => {
    if (open) setTab(eventId ? "event" : "events");
  }, [open, row?.teamId, eventId]);

  useEffect(() => {
    if (!open || !row?.teamId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEvents(null);

    const params = new URLSearchParams();
    if (programCode) params.set("program", programCode);
    if (seasonId) params.set("season", String(seasonId));
    const qs = params.toString() ? `?${params.toString()}` : "";
    fetch(`/api/teams/${row.teamId}/events${qs}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<{ events: EventRef[] }>;
      })
      .then((json) => {
        if (cancelled) return;
        setEvents(json.events);
      })
      .catch((e) => {
        if (cancelled) return;
        setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, row?.teamId, programCode, seasonId]);

  if (!row) return null;

  const rankingByEvent = new Map<number, Ranking>();
  for (const r of row.rankings) {
    if (r.event?.id != null) rankingByEvent.set(r.event.id, r);
  }

  const sortedEvents = events
    ? [...events].sort((a, b) => {
        const aT = a.start ? new Date(a.start).getTime() : 0;
        const bT = b.start ? new Date(b.start).getTime() : 0;
        return bT - aT;
      })
    : null;

  const location = [row.city, row.region, row.country]
    .filter(Boolean)
    .join(", ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl p-4 sm:p-6">
        <DialogHeader>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pr-8">
            <span className="font-mono text-xl font-bold text-primary sm:text-2xl">
              {row.teamNumber}
            </span>
            <DialogTitle className="text-base text-foreground sm:text-lg">
              {row.teamName ?? "—"}
            </DialogTitle>
            {programCode && (
              <WatchToggle
                watching={watchlist.has(row.teamNumber, programCode)}
                onToggle={() =>
                  watchlist.toggle({
                    teamId: row.teamId,
                    teamNumber: row.teamNumber,
                    teamName: row.teamName,
                    program: programCode,
                  })
                }
              />
            )}
            {onForceRefresh && row.teamId != null && (
              <button
                type="button"
                disabled={refreshing}
                onClick={async () => {
                  if (!row.teamId) return;
                  setRefreshing(true);
                  try {
                    onForceRefresh(row.teamId);
                  } finally {
                    setTimeout(() => setRefreshing(false), 2000);
                  }
                }}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                title="Re-fetch data from RobotEvents"
              >
                <RefreshCw
                  className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
                />
                Sync
              </button>
            )}
          </div>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {row.organization && (
              <span className="flex items-center gap-1 min-w-0">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{row.organization}</span>
              </span>
            )}
            {location && (
              <span className="flex items-center gap-1 min-w-0">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{location}</span>
              </span>
            )}
            {row.grade && (
              <Badge variant="muted" className="text-[10px]">
                {row.grade}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <SummaryStats row={row} />

        <div className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 p-1 overflow-x-auto">
          {eventId && row.teamId != null && (
            <TabButton
              active={tab === "event"}
              onClick={() => setTab("event")}
              label="This event"
            />
          )}
          <TabButton
            active={tab === "events"}
            onClick={() => setTab("events")}
            label={`Events (${events?.length ?? row.eventCount})`}
          />
          <TabButton
            active={tab === "awards"}
            onClick={() => setTab("awards")}
            label={`Awards (${row.awards.length})`}
          />
          <TabButton
            active={tab === "skills"}
            onClick={() => setTab("skills")}
            label={`Skills (${row.skills.length})`}
          />
        </div>

        {tab === "event" && eventId && row.teamId != null && (
          <section>
            <TeamMatchHistory
              eventId={eventId}
              teamId={row.teamId}
              teamNumber={row.teamNumber}
              teamNames={eventTeamNames}
              compact
            />
          </section>
        )}

        {tab === "events" && (
          <EventsSection
            events={sortedEvents}
            rankingByEvent={rankingByEvent}
            loading={loading}
            error={error}
            programCode={programCode}
            myTeam={row.teamNumber}
          />
        )}

        {tab === "awards" && (
          <AwardsSection awards={row.awards} events={events} />
        )}

        {tab === "skills" && (
          <SkillsSection skills={row.skills} events={events} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function WatchToggle({
  watching,
  onToggle,
}: {
  watching: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={watching ? "Remove from watchlist" : "Save to watchlist"}
      aria-pressed={watching}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
        watching
          ? "border-brand-orange/60 bg-brand-orange-soft text-foreground"
          : "border-border text-muted-foreground hover:border-brand-orange/50 hover:text-foreground",
      )}
    >
      <Star
        className={cn(
          "h-3.5 w-3.5",
          watching ? "fill-brand-orange text-brand-orange" : "",
        )}
      />
      {watching ? "Watching" : "Watch"}
    </button>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function SummaryStats({ row }: { row: TeamRow }) {
  const stats = [
    { label: "Skills Rank", value: row.skillsWorldRank ?? "—" },
    { label: "Skills Score", value: row.skillsScore ?? "—" },
    { label: "Prog", value: row.progScore ?? "—" },
    { label: "Driver", value: row.driverScore ?? "—" },
    { label: "Awards", value: row.awardCount },
    { label: "Events", value: row.eventCount },
    { label: "Best Rank", value: row.bestEventRank ?? "—" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-4 md:grid-cols-7">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {s.label}
          </span>
          <span className="font-mono text-sm font-semibold text-foreground">
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function AwardsSection({
  awards,
  events,
}: {
  awards: Award[];
  events: EventRef[] | null;
}) {
  if (awards.length === 0) {
    return (
      <section>
        <SectionTitle>Awards</SectionTitle>
        <p className="text-xs text-muted-foreground">No awards this season.</p>
      </section>
    );
  }

  const eventById = new Map<number, EventRef>();
  if (events) {
    for (const e of events) eventById.set(e.id, e);
  }

  const sorted = [...awards].sort((a, b) => {
    const ta = awardTierFor(a.title).tier;
    const tb = awardTierFor(b.title).tier;
    return ta - tb;
  });

  return (
    <section>
      <SectionTitle>Awards ({awards.length})</SectionTitle>
      <ul className="flex flex-col gap-1.5">
        {sorted.map((a) => {
          const t = awardTierFor(a.title);
          const ev = a.event?.id != null ? eventById.get(a.event.id) : null;
          const evDate = ev?.start ? formatDate(ev.start) : null;

          return (
            <li
              key={a.id}
              className="rounded-md border border-border bg-muted/30 px-3 py-2 space-y-1"
            >
              <Badge variant={t.variant} className="shrink-0">
                {t.icon}
                <span className="truncate">{a.title}</span>
              </Badge>
              {a.event?.name && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="truncate">@ {a.event.name}</span>
                  {evDate && (
                    <span className="flex items-center gap-1 shrink-0">
                      <Calendar className="h-3 w-3" />
                      {evDate}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EventsSection({
  events,
  rankingByEvent,
  loading,
  error,
  programCode,
  myTeam,
}: {
  events: EventRef[] | null;
  rankingByEvent: Map<number, Ranking>;
  loading: boolean;
  error: string | null;
  programCode?: string;
  myTeam: string;
}) {
  if (loading) {
    return (
      <section>
        <SectionTitle>Events</SectionTitle>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading events…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <SectionTitle>Events</SectionTitle>
        <p className="text-xs text-destructive break-all">
          Failed to load events: {error}
        </p>
      </section>
    );
  }

  if (!events || events.length === 0) {
    return (
      <section>
        <SectionTitle>Events</SectionTitle>
        <p className="text-xs text-muted-foreground">No events this season.</p>
      </section>
    );
  }

  return (
    <section>
      <ul className="flex flex-col gap-1.5">
        {events.map((e) => {
          const rank = rankingByEvent.get(e.id);
          const href = `/events/${e.id}?myTeam=${encodeURIComponent(myTeam)}${programCode ? `&program=${programCode}` : ""}`;
          return (
            <li key={e.id}>
              <Link
                href={href}
                className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 transition-colors hover:border-primary/40 hover:bg-muted/60"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">
                    {e.name}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                    {e.start && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(e.start)}
                      </span>
                    )}
                    {e.level && <span>· {e.level}</span>}
                  </div>
                </div>
                {rank ? (
                  <div className="flex flex-col items-end shrink-0">
                    <span className="font-mono text-sm font-semibold text-primary">
                      #{rank.rank}
                    </span>
                    {(rank.wins != null ||
                      rank.losses != null ||
                      rank.ties != null) && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {rank.wins ?? 0}-{rank.losses ?? 0}-{rank.ties ?? 0}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SkillsSection({
  skills,
  events,
}: {
  skills: Skill[];
  events: EventRef[] | null;
}) {
  // Group runs by event so we can show prog + driver side by side per event,
  // and rank events by combined score (best first).
  const groups = useMemo(() => {
    const eventNameById = new Map<number, string>();
    if (events) {
      for (const e of events) eventNameById.set(e.id, e.name);
    }
    type Group = {
      eventId: number | null;
      eventName: string;
      prog: number | null;
      driver: number | null;
      progRank: number | null;
      driverRank: number | null;
      attempts: number;
    };
    const map = new Map<string, Group>();
    for (const s of skills) {
      const id = s.event?.id ?? null;
      const key = id == null ? "__no_event__" : String(id);
      const cur =
        map.get(key) ??
        ({
          eventId: id,
          eventName:
            (id != null && eventNameById.get(id)) ??
            s.event?.name ??
            "Unattached run",
          prog: null,
          driver: null,
          progRank: null,
          driverRank: null,
          attempts: 0,
        } as Group);
      const t = String(s.type).toLowerCase();
      if (t === "programming") {
        cur.prog = Math.max(cur.prog ?? 0, s.score);
        if (s.rank != null)
          cur.progRank =
            cur.progRank == null ? s.rank : Math.min(cur.progRank, s.rank);
      } else if (t === "driver") {
        cur.driver = Math.max(cur.driver ?? 0, s.score);
        if (s.rank != null)
          cur.driverRank =
            cur.driverRank == null ? s.rank : Math.min(cur.driverRank, s.rank);
      }
      cur.attempts += s.attempts ?? 0;
      map.set(key, cur);
    }
    const arr = [...map.values()];
    arr.sort(
      (a, b) =>
        (b.prog ?? 0) + (b.driver ?? 0) - ((a.prog ?? 0) + (a.driver ?? 0)),
    );
    return arr;
  }, [skills, events]);

  if (skills.length === 0) {
    return (
      <section>
        <p className="text-xs text-muted-foreground">
          No skills runs this season.
        </p>
      </section>
    );
  }

  return (
    <section>
      <ul className="flex flex-col gap-1.5">
        {groups.map((g, i) => {
          const total = (g.prog ?? 0) + (g.driver ?? 0);
          return (
            <li
              key={g.eventId ?? `none-${i}`}
              className="rounded-md border border-border bg-muted/30 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-foreground truncate">
                    {g.eventName}
                  </div>
                </div>
                <div className="flex shrink-0 items-baseline gap-1">
                  <Target className="h-3 w-3 text-brand-orange" />
                  <span className="font-mono text-base font-semibold text-foreground">
                    {total || "—"}
                  </span>
                </div>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11px]">
                <SkillRunCell
                  label="Programming"
                  score={g.prog}
                  rank={g.progRank}
                />
                <SkillRunCell
                  label="Driver"
                  score={g.driver}
                  rank={g.driverRank}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SkillRunCell({
  label,
  score,
  rank,
}: {
  label: string;
  score: number | null;
  rank: number | null;
}) {
  return (
    <div className="rounded bg-background/60 px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {rank != null && (
          <span className="font-mono text-[10px] text-muted-foreground">
            #{rank}
          </span>
        )}
      </div>
      <div className="font-mono text-sm font-semibold text-foreground">
        {score ?? "—"}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}
