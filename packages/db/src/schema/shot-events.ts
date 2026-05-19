import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import {
  shotEventSourceEnum,
  shotOutcomeEnum,
  shotSideEnum,
  shotTypeEnum,
} from "./enums.js";
import { users } from "./users.js";
import { videos } from "./videos.js";

/**
 * Per-video shot tags (manual MVP). Ownership is enforced via `videos.user_id`
 * in the API; `created_by_user_id` records who inserted the row.
 */
export const shotEvents = pgTable(
  "shot_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    /** Nullable until rally segmentation exists; no FK yet. */
    rallyId: uuid("rally_id"),
    timestampSeconds: doublePrecision("timestamp_seconds").notNull(),
    shotType: shotTypeEnum("shot_type").notNull(),
    side: shotSideEnum("shot_side").notNull(),
    outcome: shotOutcomeEnum("shot_outcome").notNull(),
    note: text("note"),
    source: shotEventSourceEnum("source").notNull().default("manual"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    videoTimestampIdx: index("shot_events_video_timestamp_idx").on(
      table.videoId,
      table.timestampSeconds,
    ),
    videoCreatedIdx: index("shot_events_video_created_idx").on(table.videoId, table.createdAt),
  }),
);

export type ShotEventRow = typeof shotEvents.$inferSelect;
export type NewShotEventRow = typeof shotEvents.$inferInsert;
