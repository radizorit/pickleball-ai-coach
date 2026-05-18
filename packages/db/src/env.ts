/**
 * Minimal DB-package env loader. The web/worker apps each have their own
 * env story (Next.js handles its own .env loading; the worker uses dotenv).
 * Here we read at import time only when running drizzle-kit / migrate.ts.
 */
import { config } from "dotenv";
import { z } from "zod";

if (!process.env.DATABASE_URL) {
  // Allow callers to skip dotenv (e.g. inside Next.js where it's already loaded).
  config({ path: process.env.DOTENV_PATH ?? ".env" });
  config({ path: "../../.env", override: false });
}

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),
});

export const dbEnv = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
});
