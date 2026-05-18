import { z } from "zod";

/**
 * Type-safe API environment. Parsed once at boot — if any required variable
 * is missing the process exits with a readable error before Nest even tries
 * to spin up modules.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  // Comma-separated allowlist for browser callers. Always required, even in
  // dev, so a misconfigured prod can't accidentally fall back to "*".
  CORS_ORIGINS: z.string().min(1, "CORS_ORIGINS is required (comma-separated origin URLs)"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required for JWT verification"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid postgres URL"),
});

export type ApiEnv = z.infer<typeof schema>;

export function loadEnv(): ApiEnv {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const lines = Object.entries(result.error.flatten().fieldErrors)
      .map(([k, v]) => `  - ${k}: ${(v ?? []).join(", ")}`)
      .join("\n");
    throw new Error(`Invalid API environment variables:\n${lines}`);
  }
  return result.data;
}
