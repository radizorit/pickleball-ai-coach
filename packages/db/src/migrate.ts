/**
 * Stand-alone migration runner. Used both locally (`pnpm db:migrate`) and
 * in CI / release scripts before app deploys.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { dbEnv } from "./env.js";

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

async function main() {
  const url = dbEnv.DATABASE_URL_UNPOOLED ?? dbEnv.DATABASE_URL;
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);

  console.info("Running migrations…");
  await migrate(db, { migrationsFolder });
  console.info("Migrations complete.");

  await sql.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
