import type { ProgramCode } from "@/lib/robotevents/programs";

// Two top-level leagues a student picks from on the home page. Internally
// this maps to a RobotEvents `ProgramCode` (VIQRC for IQ, V5RC for V5).
//
// We intentionally do NOT expose VURC and VAIRC at the league-picker level:
// those are niche programs handled through "More" / search flows.
export type League = "iq" | "v5";

export const LEAGUES: League[] = ["iq", "v5"];

export const LEAGUE_LABEL: Record<League, string> = {
  iq: "VEX IQ",
  v5: "VEX V5",
};

export const LEAGUE_TAGLINE: Record<League, string> = {
  iq: "Elementary & Middle School",
  v5: "Middle & High School",
};

export const LEAGUE_PROGRAM: Record<League, ProgramCode> = {
  iq: "VIQRC",
  v5: "V5RC",
};

const PROGRAM_TO_LEAGUE: Partial<Record<ProgramCode, League>> = {
  VIQRC: "iq",
  V5RC: "v5",
};

export function isLeague(value: string): value is League {
  return value === "iq" || value === "v5";
}

export function leagueFromProgram(program: ProgramCode): League | null {
  return PROGRAM_TO_LEAGUE[program] ?? null;
}

// Parse a pathname like "/v5" or "/v5/abc" → "v5". Returns null if the path
// is not under a league route (e.g. "/", "/profile", "/awards").
export function leagueFromPathname(pathname: string): League | null {
  const seg = pathname.split("/")[1];
  return seg && isLeague(seg) ? seg : null;
}

export const LAST_LEAGUE_KEY = "vex-hub:last-league";
