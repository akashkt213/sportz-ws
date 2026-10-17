import { z } from "zod";
import type { MatchStatus } from "../db/schema.js";

export const MATCH_STATUS = {
  SCHEDULED: "scheduled",
  LIVE: "live",
  FINISHED: "finished",
} as const satisfies Record<string, MatchStatus>;

// ISO 8601 date-time with an explicit offset, e.g. 2026-10-17T18:30:00Z or 2026-10-17T18:30:00.000+05:30.
// The offset is required because the columns are timestamptz; without it the server's zone would be guessed.
const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,9})?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/;

function isIsoDateString(value: string): boolean {
  const match = ISO_DATE_TIME.exec(value);
  if (!match) return false;

  // Date.parse silently rolls 2026-02-30 over to March 2, so check the day exists in that month.
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return false;

  return !Number.isNaN(Date.parse(value));
}

const isoDateString = z.string().refine(isIsoDateString, {
  error: "Must be a valid ISO 8601 date-time with a timezone offset (e.g. 2026-10-17T18:30:00Z)",
});

const nonNegativeInt = z.coerce.number().int().nonnegative();

export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createMatchSchema = z
  .object({
    sport: z.string().trim().min(1),
    homeTeam: z.string().trim().min(1),
    awayTeam: z.string().trim().min(1),
    startTime: isoDateString,
    endTime: isoDateString,
    homeScore: nonNegativeInt.optional(),
    awayScore: nonNegativeInt.optional(),
  })
  .superRefine((data, ctx) => {
    const start = Date.parse(data.startTime);
    const end = Date.parse(data.endTime);
    if (end <= start) {
      ctx.addIssue({
        code: "custom",
        message: "endTime must be after startTime",
        path: ["endTime"],
      });
    }
  });

export const updateScoreSchema = z.object({
  homeScore: nonNegativeInt,
  awayScore: nonNegativeInt,
});

export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;
export type MatchIdParam = z.infer<typeof matchIdParamSchema>;
export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type UpdateScoreInput = z.infer<typeof updateScoreSchema>;
