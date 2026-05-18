/**
 * Load monorepo root `.env` before env validation. `tsx` runs with cwd under
 * `apps/worker`, so Node does not otherwise see the repo-level `.env`.
 */
import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootEnvPath =
  process.env.DOTENV_PATH ??
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env");

loadDotenv({ path: rootEnvPath });
