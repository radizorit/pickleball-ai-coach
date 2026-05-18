/**
 * Drizzle client. Uses `postgres` for both local Postgres and Neon's
 * connection string. In production we recommend the pooled URL.
 *
 * The client is a module-level singleton so route handlers don't open a
 * new connection per request.
 */
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index.js";

export type DB = PostgresJsDatabase<typeof schema>;

let cached: DB | null = null;
let cachedClient: ReturnType<typeof postgres> | null = null;

export interface CreateDbOptions {
  url?: string;
  max?: number;
  prepare?: boolean;
}

export function createDb(options: CreateDbOptions = {}): DB {
  const url = options.url ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to create a DB client");
  }

  if (cached && cachedClient) {
    return cached;
  }

  cachedClient = postgres(url, {
    max: options.max ?? 10,
    prepare: options.prepare ?? false,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  cached = drizzle(cachedClient, { schema });
  return cached;
}

/**
 * Get the singleton DB. Lazily creates it on first call.
 */
export function getDb(): DB {
  return cached ?? createDb();
}

export { schema };
