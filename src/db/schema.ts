import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const matchStatus = pgEnum("match_status", ["scheduled", "live", "finished"]);

export const matches = pgTable(
  "matches",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    sport: text("sport").notNull(),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    status: matchStatus("status").notNull().default("scheduled"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }),
    homeScore: integer("home_score").notNull().default(0),
    awayScore: integer("away_score").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Dashboards list matches by state ("what's live now?") and by kickoff time.
    index("matches_status_start_time_idx").on(table.status, table.startTime),
  ],
);

export const commentary = pgTable(
  "commentary",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    minute: integer("minute"),
    sequence: integer("sequence").notNull(),
    period: text("period"),
    eventType: text("event_type"),
    actor: text("actor"),
    team: text("team"),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    tags: text("tags").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Live feeds read a match's commentary in order and resume from the last sequence seen.
    index("commentary_match_id_sequence_idx").on(table.matchId, table.sequence),
  ],
);

export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type Commentary = typeof commentary.$inferSelect;
export type NewCommentary = typeof commentary.$inferInsert;
export type MatchStatus = (typeof matchStatus.enumValues)[number];
