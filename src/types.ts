import type { Award, EventRef, Ranking, Skill } from "@/lib/robotevents/schemas";

export type TeamRow = {
  teamNumber: string;
  teamId: number | null;
  teamName: string | null;
  organization: string | null;
  grade: string | null;
  city: string | null;
  region: string | null;
  country: string | null;

  skillsWorldRank: number | null;
  skillsScore: number | null;
  progScore: number | null;
  driverScore: number | null;

  awardCount: number;
  topAward: string | null;
  awardTier: number;
  hasExcellence: boolean;

  eventCount: number;
  bestEventRank: number | null;

  awards: Award[];
  events: EventRef[];
  rankings: Ranking[];
  skills: Skill[];

  notFound: boolean;
  fetchedAt: string;
};
