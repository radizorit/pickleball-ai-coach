import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Liveness probe for the web app itself. Does NOT call the API — keep this
 * cheap so platform health checks don't cascade-fail when only the API is
 * degraded. Use /v1/health on the API for upstream checks.
 */
export function GET() {
  return NextResponse.json({ status: "ok", service: "web", ts: Date.now() });
}
