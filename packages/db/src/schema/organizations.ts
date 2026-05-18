import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { orgRoleEnum, planEnum } from "./enums.js";
import { users } from "./users.js";

/**
 * An organization is the unit of ownership for videos, billing, and
 * permissions. Every user gets a personal org on signup (1 owner, 1 member).
 * Coaches / clubs upgrade to a shared org with multiple members.
 *
 * No Stripe / billing columns here — those will live on a separate
 * `subscriptions` table when billing lands.
 */
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    plan: planEnum("plan").notNull().default("free"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    nameIdx: index("organizations_name_idx").on(table.name),
  }),
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull().default("player"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    uniqueMember: uniqueIndex("organization_members_org_user_idx").on(
      table.organizationId,
      table.userId,
    ),
    userIdx: index("organization_members_user_id_idx").on(table.userId),
  }),
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;
