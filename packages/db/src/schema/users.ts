import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Application user. `external_auth_id` stores the stable subject from the
 * auth provider (Clerk `user_…` id). Nullable for legacy / seed rows only.
 *
 * `external_auth_provider` keeps the door open for a second provider later
 * without a wide schema rewrite — today it is always `clerk`.
 *
 * `defaultOrgId` is reserved for the personal workspace; org provisioning is
 * a follow-up task (see README). Nullable until then.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalAuthId: text("external_auth_id"),
    externalAuthProvider: text("external_auth_provider").notNull().default("clerk"),
    email: text("email").notNull().unique(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    defaultOrgId: uuid("default_org_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
    externalAuthUnique: uniqueIndex("users_external_auth_id_unique").on(table.externalAuthId),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
