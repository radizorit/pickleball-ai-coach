/**
 * Local dev seed. Inserts a demo user without Clerk identity so local API
 * smoke tests can run before auth is configured.
 *
 * Idempotent: re-running `pnpm db:seed` will not create duplicates.
 *
 * Organization tables exist in the schema for future phases; this seed
 * intentionally does not create org rows (org provisioning is deferred).
 */
import { eq } from "drizzle-orm";

import { createDb } from "./client.js";
import { users } from "./schema/index.js";

const DEMO_EMAIL = "demo@pickleball.local";

async function main() {
  const db = createDb();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);
  if (existing) {
    console.info(`Seed: demo user already exists (${existing.id}), skipping.`);
    return;
  }

  await db.insert(users).values({
    email: DEMO_EMAIL,
    name: "Demo Player",
    externalAuthProvider: "clerk",
  });

  console.info("Seed: created demo user (no external_auth_id).");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
