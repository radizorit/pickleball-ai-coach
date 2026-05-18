import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit loads this file via esbuild — keep it self-contained so it
// does not need to resolve our ESM src/* imports at runtime.
loadEnv({ path: ".env" });
loadEnv({ path: "../../.env", override: false });

const url =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  "postgres://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  // Compiled JS so drizzle-kit resolves `./enums.js` on disk. `db:push` /
  // `db:generate` chain `pnpm --filter @pickleball/shared build && pnpm build`.
  schema: "./dist/schema/index.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
