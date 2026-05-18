import { eq, sql } from "drizzle-orm";

import type { DB } from "./client.js";
import { users, type User } from "./schema/index.js";

export interface UpsertUserFromExternalAuthInput {
  externalAuthProvider: string;
  externalAuthId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * Idempotent upsert keyed by `external_auth_id`. Used by the Nest API
 * (`GET /v1/me`) and the Clerk webhook handler so user profile data never
 * diverges across entry points.
 *
 * Does not touch organizations — `default_org_id` stays null until org
 * provisioning ships.
 */
export async function upsertUserFromExternalAuth(
  db: DB,
  input: UpsertUserFromExternalAuthInput,
): Promise<User> {
  const [row] = await db
    .insert(users)
    .values({
      externalAuthProvider: input.externalAuthProvider,
      externalAuthId: input.externalAuthId,
      email: input.email,
      name: input.name,
      avatarUrl: input.avatarUrl,
    })
    .onConflictDoUpdate({
      target: users.externalAuthId,
      set: {
        email: input.email,
        name: input.name,
        avatarUrl: input.avatarUrl,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  if (!row) {
    throw new Error("upsertUserFromExternalAuth: no row returned");
  }

  return row;
}

export async function findUserByExternalAuthId(
  db: DB,
  externalAuthId: string,
): Promise<User | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.externalAuthId, externalAuthId))
    .limit(1);
  return row;
}
