import { z } from "zod";

import { DEFAULT_MAX_VIDEO_UPLOAD_BYTES } from "@pickleball/shared/constants";

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

  // --- S3-compatible object storage (AWS S3 or Cloudflare R2). All optional:
  // when unset, presigned upload routes return 503 via the noop adapter.
  S3_BUCKET: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  MAX_VIDEO_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(DEFAULT_MAX_VIDEO_UPLOAD_BYTES)
    .default(DEFAULT_MAX_VIDEO_UPLOAD_BYTES),
  PRESIGNED_UPLOAD_EXPIRES_SECONDS: z.coerce.number().int().positive().max(604800).default(3600),
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
