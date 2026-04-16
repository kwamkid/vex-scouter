import type { Award } from "@/lib/robotevents/schemas";

export const AWARD_PRIORITY: { pattern: RegExp; tier: number; label: string }[] = [
  { pattern: /excellence/i, tier: 1, label: "Excellence" },
  { pattern: /tournament champion/i, tier: 2, label: "Tournament Champion" },
  { pattern: /tournament finalist/i, tier: 3, label: "Tournament Finalist" },
  { pattern: /design award/i, tier: 4, label: "Design" },
  { pattern: /(build|innovate|think|judges)/i, tier: 5, label: "Build/Innovate/Think/Judges" },
  { pattern: /(amaze|sportsmanship)/i, tier: 6, label: "Amaze/Sportsmanship" },
  { pattern: /create/i, tier: 7, label: "Create" },
];

export function classifyAwards(awards: Award[]): {
  topAward: string | null;
  tier: number;
  hasExcellence: boolean;
} {
  if (!awards.length) return { topAward: null, tier: 0, hasExcellence: false };

  let bestTier = 99;
  let bestLabel: string | null = null;
  let bestTitle: string | null = null;
  let hasExcellence = false;

  for (const a of awards) {
    for (const rule of AWARD_PRIORITY) {
      if (rule.pattern.test(a.title)) {
        if (rule.tier === 1) hasExcellence = true;
        if (rule.tier < bestTier) {
          bestTier = rule.tier;
          bestLabel = rule.label;
          bestTitle = a.title;
        }
        break;
      }
    }
  }

  if (bestTier === 99) {
    return { topAward: awards[0].title, tier: 8, hasExcellence: false };
  }
  return {
    topAward: bestTitle ?? bestLabel,
    tier: bestTier,
    hasExcellence,
  };
}
