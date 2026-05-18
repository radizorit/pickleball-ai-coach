/**
 * Whether Clerk is fully configured for this build/runtime.
 *
 * `.env.example` ships with `pk_test_REPLACE_ME` so `next build` / CI can
 * compile without real dashboard keys. Production must set real keys and
 * omit `REPLACE_ME`.
 */
export function isClerkConfigured(): boolean {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  if (!pk) return false;
  if (pk.includes("REPLACE_ME")) return false;
  return pk.startsWith("pk_test_") || pk.startsWith("pk_live_");
}
