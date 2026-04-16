import type { TeamRow } from "@/types";
import type {
  Award,
  EventRef,
  Ranking,
  Skill,
  Team,
} from "@/lib/robotevents/schemas";
import { classifyAwards } from "./awards";

function countDistinctEvents(
  rankings: Ranking[],
  skills: Skill[],
  awards: Award[],
): number {
  const ids = new Set<number>();
  for (const r of rankings) if (r.event?.id != null) ids.add(r.event.id);
  for (const s of skills) if (s.event?.id != null) ids.add(s.event.id);
  for (const a of awards) if (a.event?.id != null) ids.add(a.event.id);
  return ids.size;
}

export function aggregateTeamRow(params: {
  number: string;
  team: Team | null;
  awards: Award[];
  events: EventRef[];
  rankings: Ranking[];
  skills: Skill[];
  worldSkillsMap: Map<number, number>;
}): TeamRow {
  const now = new Date().toISOString();

  if (!params.team) {
    return {
      teamNumber: params.number,
      teamId: null,
      teamName: null,
      organization: null,
      grade: null,
      city: null,
      region: null,
      country: null,
      skillsWorldRank: null,
      skillsScore: null,
      progScore: null,
      driverScore: null,
      awardCount: 0,
      topAward: null,
      awardTier: 0,
      hasExcellence: false,
      eventCount: 0,
      bestEventRank: null,
      awards: [],
      events: [],
      rankings: [],
      skills: [],
      notFound: true,
      fetchedAt: now,
    };
  }

  // Group skills by event; best combined = max(prog+driver) per event
  const byEvent = new Map<string | number, { prog: number; driver: number }>();
  for (const s of params.skills) {
    const key = s.event?.id ?? "no-event";
    const cur = byEvent.get(key) ?? { prog: 0, driver: 0 };
    const t = String(s.type).toLowerCase();
    if (t === "programming") cur.prog = Math.max(cur.prog, s.score);
    else if (t === "driver") cur.driver = Math.max(cur.driver, s.score);
    byEvent.set(key, cur);
  }

  let bestCombined = 0;
  for (const v of byEvent.values()) {
    bestCombined = Math.max(bestCombined, v.prog + v.driver);
  }

  const bestProg = params.skills
    .filter((s) => String(s.type).toLowerCase() === "programming")
    .reduce((m, s) => Math.max(m, s.score), 0);
  const bestDriver = params.skills
    .filter((s) => String(s.type).toLowerCase() === "driver")
    .reduce((m, s) => Math.max(m, s.score), 0);

  const { topAward, tier, hasExcellence } = classifyAwards(params.awards);

  const bestRank =
    params.rankings.length > 0
      ? Math.min(...params.rankings.map((r) => r.rank))
      : null;

  return {
    teamNumber: params.number,
    teamId: params.team.id,
    teamName: params.team.team_name ?? null,
    organization: params.team.organization ?? null,
    grade: params.team.grade ?? null,
    city: params.team.location?.city ?? null,
    region: params.team.location?.region ?? null,
    country: params.team.location?.country ?? null,

    skillsWorldRank:
      params.worldSkillsMap.get(params.team.id) ??
      (params.skills
        .map((s) => s.rank)
        .filter((r): r is number => typeof r === "number" && r > 0)
        .sort((a, b) => a - b)[0] ?? null),
    skillsScore: bestCombined || null,
    progScore: bestProg || null,
    driverScore: bestDriver || null,

    awardCount: params.awards.length,
    topAward,
    awardTier: tier,
    hasExcellence,

    eventCount: countDistinctEvents(params.rankings, params.skills, params.awards),
    bestEventRank: bestRank,

    awards: params.awards,
    events: params.events,
    rankings: params.rankings,
    skills: params.skills,

    notFound: false,
    fetchedAt: now,
  };
}
