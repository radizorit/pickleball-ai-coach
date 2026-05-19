import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Next only auto-loads `.env*` from `apps/web`; the monorepo uses a single root `.env`.
const rootEnvPath =
  process.env.DOTENV_PATH ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../.env");
loadEnv({ path: rootEnvPath });

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // Allow importing source TS from sibling monorepo packages without
  // requiring a prior build step in dev.
  transpilePackages: ["@pickleball/shared", "@pickleball/db"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
