import { defineConfig } from "drizzle-kit";

// Migrations need a direct (unpooled) connection; PgBouncer's transaction mode breaks them.
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  throw new Error("DATABASE_URL_UNPOOLED is not set. Run `neon env pull` to create .env.local.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
});
