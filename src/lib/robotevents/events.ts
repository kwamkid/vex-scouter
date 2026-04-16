import { reGet, reGetAllPaged } from "./client";
import {
  EventRefSchema,
  RankingSchema,
  TeamSchema,
  type EventRef,
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
