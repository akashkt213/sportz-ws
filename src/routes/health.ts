import { sql } from "drizzle-orm";
import { Router } from "express";
import { db } from "../db/index.js";

export const healthRouter = Router();

healthRouter.get("/db", async (_req, res) => {
  try {
    const { rows } = await db.execute<{ time: string; version: string }>(
      sql`SELECT now() AS time, version() AS version`,
    );
    res.json({ ok: true, ...rows[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Database check failed:", message);
    res.status(500).json({ ok: false, error: message });
  }
});
