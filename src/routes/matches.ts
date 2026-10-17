import { desc } from "drizzle-orm";
import { Router } from "express";
import { createMatchSchema, listMatchesQuerySchema, MATCH_STATUS } from "../validation/matches.js";
import { db } from "../db/index.js";
import { matches } from "../db/schema.js";
import { getMatchStatus } from "../utils/match-status.js";

const DEFAULT_LIMIT = 50;

export const matchRouter = Router();

matchRouter.get("/", async (req, res) => {
  const parsed = listMatchesQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid query",
      details: parsed.error.issues,
    });
  }

  try {
    const data = await db
      .select()
      .from(matches)
      .orderBy(desc(matches.createdAt))
      .limit(parsed.data.limit ?? DEFAULT_LIMIT);

    res.json({ data });
  } catch (error) {
    console.error("Failed to list matches:", error);
    res.status(500).json({ error: "Failed to list matches" });
  }
});

matchRouter.post("/", async (req, res) => {
  const parsed = createMatchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payload",
      details: parsed.error.issues,
    });
  }

  const { startTime, endTime, homeScore, awayScore } = parsed.data;

  try {
    const [event] = await db
      .insert(matches)
      .values({
        ...parsed.data,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        // Times are already validated, so null is unreachable; the fallback satisfies the NOT NULL column.
        status: getMatchStatus(startTime, endTime) ?? MATCH_STATUS.SCHEDULED,
      })
      .returning();

    res.status(201).json({ data: event });

    // The match is already saved; a broadcast failure must not turn this into a 500.
    if (event) {
      try {
        req.app.locals.broadcastMatchCreated?.(event);
      } catch (error) {
        console.error("Failed to broadcast match_created:", error);
      }
    }
  } catch (error) {
    console.error("Failed to create match:", error);
    res.status(500).json({ error: "Failed to create a match" });
  }
});
