import { z } from "zod";

const optionalText = z.string().trim().min(1).optional();

export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// matchId is not part of the body: it comes from the route (/matches/:id/commentary),
// validated with matchIdParamSchema.
export const createCommentarySchema = z.object({
  minute: z.coerce.number().int().nonnegative().optional(),
  // Required because the column is NOT NULL; live feeds order and resume by it.
  sequence: z.coerce.number().int().nonnegative(),
  period: optionalText,
  eventType: optionalText,
  actor: optionalText,
  team: optionalText,
  message: z.string().trim().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
});

export type ListCommentaryQuery = z.infer<typeof listCommentaryQuerySchema>;
export type CreateCommentaryInput = z.infer<typeof createCommentarySchema>;
