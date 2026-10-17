import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

// Neon issues `sslmode=require`; pin pg's current (strict) behavior explicitly so it
// stays verify-full when pg v9 switches `require` to weaker libpq semantics.
const url = new URL(env.databaseUrl);
url.searchParams.set("sslmode", "verify-full");

// One shared pool for the long-running server, using Neon's pooled connection string.
export const pool = new Pool({
  connectionString: url.toString(),
  max: 10,
});

// Neon can close idle connections (e.g. scale to zero); log instead of crashing.
pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error:", err.message);
});

export const db = drizzle(pool, { schema });
