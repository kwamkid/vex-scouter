const TEAM_REGEX = /^[0-9]+[A-Z]?$/i;

export function parseTeamInput(raw: string, max = 100): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const lines = raw.split(/\r?\n|,|;/);
  for (const line of lines) {
    const trimmed = line.trim().toUpperCase();
    if (!trimmed) continue;
    if (!TEAM_REGEX.test(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}
