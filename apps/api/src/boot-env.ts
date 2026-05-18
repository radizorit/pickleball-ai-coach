/**
 * Load monorepo root `.env` before `loadEnv()` in main.ts. Nest `ConfigModule`
 * runs after `NestFactory.create`, so zod in main would otherwise see an empty
 * `process.env` when the shell cwd is `apps/api`.
 */
import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootEnvPath =
  process.env.DOTENV_PATH ??
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env");

loadDotenv({ path: rootEnvPath });
