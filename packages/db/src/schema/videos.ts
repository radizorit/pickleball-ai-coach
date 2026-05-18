import { sql } from "drizzle-orm";
import { bigint, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { matchTypeEnum, processingStatusEnum, videoPrivacyEnum } from "./enums.js";
import { organizations } from "./organizations.js";
import { users } from "./users.js";

/**
 * A user-uploaded video record. Foundation-only:
 * - No storage-provider-specific columns (e.g. R2 keys) — those will land
 *   with the upload feature.
 * - No preview / thumbnail columns — those land with the worker.
 * - `processingStatus` is present so the future upload + worker code can
 *   transition rows through `pending -> processing -> ready` without a
 *   schema change.
 */
export const videos = pgTable(
  "videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    durationSeconds: integer("duration_seconds"),
    fps: integer("fps"),
    width: integer("width"),
    height: integer("height"),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    processingStatus: processingStatusEnum("processing_status").notNull().default("pending"),
    privacy: videoPrivacyEnum("privacy").notNull().default("private"),
    matchType: matchTypeEnum("match_type"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    orgCreatedIdx: index("videos_org_created_idx").on(table.organizationId, table.createdAt),
    userCreatedIdx: index("videos_user_created_idx").on(table.userId, table.createdAt),
    statusIdx: index("videos_processing_status_idx").on(table.processingStatus),
  }),
);

export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
