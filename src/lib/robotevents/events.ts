import { reGet, reGetAllPaged } from "./client";
import {
  EventRefSchema,
  MatchSchema,
  RankingSchema,
  TeamSchema,
  type EventRef,
  type Match,
  type Ranking,
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
