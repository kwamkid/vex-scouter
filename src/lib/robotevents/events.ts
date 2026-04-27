import { reGet, reGetAllPaged } from "./client";
import {
  EventRefSchema,
  MatchSchema,
  RankingSchema,
  SkillSchema,
  TeamSchema,
  type EventRef,
  type Match,
  type Ranking,
  type Skill,
  type Team,
} from "./schemas";

export async function getTeamEvents(
  teamId: number,
  seasonId: number,
): Promise<EventRef[]> {
  return reGetAllPaged(
    `/teams/${teamId}/events`,
    { "season[]": seasonId },
    EventRefSchema,
    { revalidate: 60 * 60, tags: [`team:${teamId}`, `team:${teamId}:events`] },
    5,
  );
}

export async function getEvent(eventId: number): Promise<EventRef> {
  return reGet(`/events/${eventId}`, undefined, EventRefSchema, {
    revalidate: 60 * 60,
    tags: [`event:${eventId}`],
  });
}

export async function getEventTeams(eventId: number): Promise<Team[]> {
  return reGetAllPaged(
    `/events/${eventId}/teams`,
    {},
    TeamSchema,
    {
      revalidate: 60 * 60,
      tags: [`event:${eventId}`, `event:${eventId}:teams`],
    },
    10,
  );
}

export async function getTeamMatchesAtEvent(
  eventId: number,
  teamId: number,
): Promise<Match[]> {
  // Matches live under each division (the event-level route doesn't exist).
  // Fan out across the event's divisions and merge.
  const event = await getEvent(eventId);
  const divisions = event.divisions ?? [];
  if (divisions.length === 0) return [];

  const perDivision = await Promise.all(
    divisions.map((d) =>
      reGetAllPaged(
        `/events/${eventId}/divisions/${d.id}/matches`,
        { "team[]": teamId },
        MatchSchema,
        {
          revalidate: 60,
          tags: [
            `event:${eventId}`,
            `event:${eventId}:matches:team:${teamId}`,
          ],
        },
        5,
      ).catch(() => [] as Match[]),
    ),
  );

  return perDivision.flat();
}

// All skills runs at this event (across teams + divisions).
export async function getEventSkills(eventId: number): Promise<Skill[]> {
  return reGetAllPaged(
    `/events/${eventId}/skills`,
    {},
    SkillSchema,
    {
      revalidate: 60,
      tags: [`event:${eventId}`, `event:${eventId}:skills`],
    },
    5,
  );
}

export type EventTeamStat = {
  rank: number | null;
  wins: number;
  losses: number;
  ties: number;
  wp: number;
  ap: number;
  sp: number;
  awp: number | null;
  skillsScore: number | null;
  progScore: number | null;
  driverScore: number | null;
  skillsRank: number | null;
};

// Aggregate per-team stats *at this specific event*: rankings (W-L-T, wp/ap/sp,
// current rank in their division) + skills (best prog + driver run, rank).
export async function getEventTeamStats(
  eventId: number,
): Promise<Map<number, EventTeamStat>> {
  const event = await getEvent(eventId);
  const divisions = event.divisions ?? [];

  const [rankingsByDiv, skills] = await Promise.all([
    Promise.all(
      divisions.map((d) => getDivisionRankings(eventId, d.id).catch(() => [])),
    ),
    getEventSkills(eventId).catch(() => [] as Skill[]),
  ]);

  const stats = new Map<number, EventTeamStat>();
  const blank = (): EventTeamStat => ({
    rank: null,
    wins: 0,
    losses: 0,
    ties: 0,
    wp: 0,
    ap: 0,
    sp: 0,
    awp: null,
    skillsScore: null,
    progScore: null,
    driverScore: null,
    skillsRank: null,
  });

  for (const rankings of rankingsByDiv) {
    for (const r of rankings) {
      const teamId = r.team?.id;
      if (teamId == null) continue;
      const cur = stats.get(teamId) ?? blank();
      cur.rank = r.rank;
      cur.wins = r.wins ?? 0;
      cur.losses = r.losses ?? 0;
      cur.ties = r.ties ?? 0;
      cur.wp = r.wp ?? 0;
      cur.ap = r.ap ?? 0;
      cur.sp = r.sp ?? 0;
      cur.awp = r.awp ?? null;
      stats.set(teamId, cur);
    }
  }

  for (const s of skills) {
    const teamId = s.team?.id;
    if (teamId == null) continue;
    const cur = stats.get(teamId) ?? blank();
    const t = String(s.type).toLowerCase();
    if (t === "programming") {
      cur.progScore = Math.max(cur.progScore ?? 0, s.score);
    } else if (t === "driver") {
      cur.driverScore = Math.max(cur.driverScore ?? 0, s.score);
    }
    if (s.rank != null) {
      cur.skillsRank =
        cur.skillsRank == null ? s.rank : Math.min(cur.skillsRank, s.rank);
    }
    stats.set(teamId, cur);
  }

  for (const stat of stats.values()) {
    if (stat.progScore != null || stat.driverScore != null) {
      stat.skillsScore = (stat.progScore ?? 0) + (stat.driverScore ?? 0);
    }
  }

  return stats;
}

export async function getDivisionRankings(
  eventId: number,
  divisionId: number,
): Promise<Ranking[]> {
  return reGetAllPaged(
    `/events/${eventId}/divisions/${divisionId}/rankings`,
    {},
    RankingSchema,
    {
      revalidate: 5 * 60,
      tags: [
        `event:${eventId}`,
        `event:${eventId}:div:${divisionId}:rankings`,
      ],
    },
    5,
  );
}
