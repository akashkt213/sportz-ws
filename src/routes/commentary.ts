import { desc, DrizzleQueryError, eq } from "drizzle-orm";
import { Router } from "express";
import { db } from "../db/index.js";
import { commentary } from "../db/schema.js";
import { createCommentarySchema, listCommentaryQuerySchema } from "../validation/commentary.js";
import { matchIdParamSchema } from "../validation/matches.js";

// The schema already caps limit at 100; this cap keeps the query safe if that rule ever changes.
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 100;

// Postgres error code for a foreign key violation: here, a matchId with no matching match.
const FOREIGN_KEY_VIOLATION = "23503";

function isForeignKeyViolation(error: unknown): boolean {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  return (cause as { code?: string } | undefined)?.code === FOREIGN_KEY_VIOLATION;
}

// mergeParams exposes :id from the parent mount path (/matches/:id/commentary).
export const commentaryRouter = Router({ mergeParams: true });

commentaryRouter.get("/", async (req, res) => {
  const params = matchIdParamSchema.safeParse(req.params);

  if (!params.success) {
    return res.status(400).json({
      error: "Invalid match id",
      details: params.error.issues,
    });
  }

  const query = listCommentaryQuerySchema.safeParse(req.query);

  if (!query.success) {
    return res.status(400).json({
      error: "Invalid query",
      details: query.error.issues,
    });
  }

  const limit = Math.min(query.data.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  try {
    const data = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, params.data.id))
      // Newest first. Rows inserted in the same instant share createdAt, so id breaks the tie
      // and keeps the order stable between requests.
      .orderBy(desc(commentary.createdAt), desc(commentary.id))
      .limit(limit);

    res.json({ data });
  } catch (error) {
    console.error("Failed to list commentary:", error);
    res.status(500).json({ error: "Failed to list commentary" });
  }
});

commentaryRouter.post("/", async (req, res) => {
  const params = matchIdParamSchema.safeParse(req.params);

  if (!params.success) {
    return res.status(400).json({
      error: "Invalid match id",
      details: params.error.issues,
    });
  }

  const body = createCommentarySchema.safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({
      error: "Invalid payload",
      details: body.error.issues,
    });
  }

  try {
    const [entry] = await db
      .insert(commentary)
      .values({ ...body.data, matchId: params.data.id })
      .returning();

    res.status(201).json({ data: entry });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return res.status(404).json({ error: `Match ${params.data.id} not found` });
    }

    console.error("Failed to create commentary:", error);
    res.status(500).json({ error: "Failed to create commentary" });
  }
});
