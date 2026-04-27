import {
  getEvent,
  getEventTeamStats,
  getTeamMatchesAtEvent,
  type EventTeamStat,
} from "@/lib/robotevents/events";
import { cacheGet, cacheSet } from "@/lib/db/cache";
import type { EventRef, Match } from "@/lib/robotevents/schemas";

// Combined endpoint that streams progress for the event scout "My matches"
// view. Replaces the old `team-matches` + `team-stats` pair (single roundtrip,
// real-time progress, Upstash-cached for repeat hits).
//
// Wire format: NDJSON. Each line is one JSON object:
//   { "type": "progress", "stage": "...", "label": "...", "percent": 0..100 }
//   { "type": "result", "data": { "matches": [...], "stats": {teamId: stat} } }
//
// Cache TTL is adaptive based on event status:
//   - Past:     7 days  (data is final)
//   - Ongoing:  30 sec  (matches/scores changing live)
//   - Upcoming: 1 hour  (schedule rarely changes that often)

type ResultPayload = {
  matches: Match[];
  stats: Record<string, EventTeamStat>;
  source: "cache" | "live";
  cachedAt?: number;
  status: "past" | "ongoing" | "upcoming" | "unknown";
};

function eventStatus(event: EventRef): ResultPayload["status"] {
  const now = Date.now();
  const start = event.start ? new Date(event.start).getTime() : null;
  const end = event.end ? new Date(event.end).getTime() : null;
  if (event.ongoing === true) return "ongoing";
  if (end != null && end < now) return "past";
  if (start != null && now < start) return "upcoming";
  if (start != null && end != null && start <= now && now <= end) {
    return "ongoing";
  }
  return "unknown";
}

function ttlForStatus(status: ResultPayload["status"]): number {
  switch (status) {
    case "past":
      return 7 * 24 * 60 * 60; // 7 days
    case "ongoing":
      return 30; // 30 seconds
    case "upcoming":
      return 60 * 60; // 1 hour
    default:
      return 5 * 60; // 5 min fallback
  }
}

function cacheKey(eventId: number, teamId: number): string {
  return `my-event:${eventId}:${teamId}`;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  const url = new URL(req.url);
  const teamIdParam = url.searchParams.get("teamId");
  const teamId = teamIdParam ? Number(teamIdParam) : NaN;
  const force = url.searchParams.get("refresh") === "1";

  if (!Number.isFinite(eventId) || !Number.isFinite(teamId)) {
    return Response.json(
      { error: "missing eventId or teamId" },
      { status: 400 },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: unknown) => {
        controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      };
      const progress = (
        stage: string,
        label: string,
        percent: number,
      ) => send({ type: "progress", stage, label, percent });

      try {
        // 1) Cache lookup ------------------------------------------------
        progress("cache", "Checking cache…", 5);

        if (!force) {
          const cached = await cacheGet<ResultPayload>(
            cacheKey(eventId, teamId),
          );
          if (cached) {
            progress("done", "Loaded from cache", 100);
            send({
              type: "result",
              data: { ...cached, source: "cache" },
            });
            controller.close();
            return;
          }
        }

        // 2) Event info --------------------------------------------------
        progress("event", "Loading event details…", 15);
        const event = await getEvent(eventId);
        const status = eventStatus(event);

        // 3) Stats + matches in parallel --------------------------------
        progress("stats", "Loading team stats & matches…", 35);
        const [stats, matches] = await Promise.all([
          getEventTeamStats(eventId).catch(
            () => new Map<number, EventTeamStat>(),
          ),
          getTeamMatchesAtEvent(eventId, teamId).catch(() => [] as Match[]),
        ]);
        progress("merge", "Assembling response…", 90);

        const statsObj: Record<string, EventTeamStat> = {};
        for (const [k, v] of stats.entries()) statsObj[String(k)] = v;

        const payload: ResultPayload = {
          matches,
          stats: statsObj,
          source: "live",
          cachedAt: Date.now(),
          status,
        };

        // Fire and forget — caching happens after the user gets data.
        void cacheSet(cacheKey(eventId, teamId), payload, ttlForStatus(status));

        progress("done", "Done", 100);
        send({ type: "result", data: payload });
        controller.close();
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
