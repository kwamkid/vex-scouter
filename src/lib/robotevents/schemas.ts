import { z } from "zod";

export const LocationSchema = z
  .object({
    city: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const TeamSchema = z.object({
  id: z.number(),
  number: z.string(),
  team_name: z.string().nullable().optional(),
  organization: z.string().nullable().optional(),
  location: LocationSchema,
  grade: z.string().nullable().optional(),
});
export type Team = z.infer<typeof TeamSchema>;

export const AwardSchema = z.object({
  id: z.number(),
  title: z.string(),
  event: z.object({ id: z.number(), name: z.string() }).nullable().optional(),
  qualifications: z.array(z.string()).optional(),
});
export type Award = z.infer<typeof AwardSchema>;

export const SkillSchema = z.object({
  id: z.number(),
  type: z.union([z.enum(["driver", "programming"]), z.string()]),
  score: z.number(),
  attempts: z.number().nullable().optional(),
  rank: z.number().nullable().optional(),
  team: z.object({ id: z.number(), name: z.string().optional() }),
  event: z.object({ id: z.number(), name: z.string() }).nullable().optional(),
  season: z.object({ id: z.number(), name: z.string().optional() }).nullable().optional(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const EventLocationSchema = z
  .object({
    venue: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const DivisionSchema = z.object({
  id: z.number(),
  name: z.string(),
  order: z.number().optional(),
});
export type Division = z.infer<typeof DivisionSchema>;

export const EventRefSchema = z.object({
  id: z.number(),
  sku: z.string().nullable().optional(),
  name: z.string(),
  start: z.string().nullable().optional(),
  end: z.string().nullable().optional(),
  level: z.string().nullable().optional(),
  season: z
    .object({ id: z.number(), name: z.string().optional() })
    .nullable()
    .optional(),
  program: z
    .object({ id: z.number(), code: z.string().optional() })
    .nullable()
    .optional(),
  location: EventLocationSchema,
  ongoing: z.boolean().optional(),
  divisions: z.array(DivisionSchema).optional(),
});
export type EventRef = z.infer<typeof EventRefSchema>;

export const RankingSchema = z.object({
  id: z.number(),
  team: z.object({ id: z.number(), name: z.string().optional().nullable() }),
  event: z.object({ id: z.number(), name: z.string().optional() }).nullable().optional(),
  division: z
    .object({ id: z.number(), name: z.string().optional() })
    .nullable()
    .optional(),
  rank: z.number(),
  wins: z.number().optional(),
  losses: z.number().optional(),
  ties: z.number().optional(),
  wp: z.number().nullable().optional(),
  ap: z.number().nullable().optional(),
  sp: z.number().nullable().optional(),
});
export type Ranking = z.infer<typeof RankingSchema>;

export const SeasonSchema = z.object({
  id: z.number(),
  name: z.string(),
  program: z.object({ id: z.number(), code: z.string().optional() }).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
});
export type Season = z.infer<typeof SeasonSchema>;

export const PagedMetaSchema = z.object({
  current_page: z.number(),
  last_page: z.number(),
  per_page: z.number(),
  total: z.number(),
});

export function PagedResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    meta: PagedMetaSchema.optional(),
  });
}
