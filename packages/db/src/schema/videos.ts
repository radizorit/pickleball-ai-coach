import { sql } from "drizzle-orm";
import { bigint, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { matchTypeEnum, processingStatusEnum, videoPrivacyEnum } from "./enums.js";
import { organizations } from "./organizations.js";
import { users } from "./users.js";

/**
 * User-owned video metadata. Upload foundation:
 * - `processing_status` drives the full lifecycle (pending → … → ready | failed).
 * - Storage columns are opaque strings so R2/S3/local adapters share one row shape.
 * - `organization_id` is nullable until personal-org provisioning exists.
 */
export const videos = pgTable(
  "videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    originalFilename: text("original_filename"),
    contentType: text("content_type"),
    storageProvider: text("storage_provider"),
    storageBucket: text("storage_bucket"),
    storageObjectKey: text("storage_object_key"),
    thumbnailObjectKey: text("thumbnail_object_key"),
    durationSeconds: integer("duration_seconds"),
    fps: integer("fps"),
    width: integer("width"),
    height: integer("height"),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    processingStatus: processingStatusEnum("processing_status").notNull().default("pending"),
    failureMessage: text("failure_message"),
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
