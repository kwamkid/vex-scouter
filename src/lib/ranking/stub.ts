import type { Team } from "@/lib/robotevents/schemas";
import type { TeamRow } from "@/types";

// Build a TeamRow from a Team payload alone — no awards/skills/rankings fetched.
// Used for instant rendering of large event rosters before we scout each team.
export function aggregateTeamStub(team: Team): TeamRow {
  const now = new Date().toISOString();
  return {
    teamNumber: team.number.toUpperCase(),
    teamId: team.id,
    teamName: team.team_name ?? null,
    organization: team.organization ?? null,
    grade: team.grade ?? null,
    city: team.location?.city ?? null,
    region: team.location?.region ?? null,
    country: team.location?.country ?? null,

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

    notFound: false,
    fetchedAt: now,
  };
}
