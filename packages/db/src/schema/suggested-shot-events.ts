import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  pgTable,
  real,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { suggestedShotSourceEnum, suggestedShotStatusEnum } from "./enums.js";
import { videos } from "./videos.js";

/**
 * Timestamp candidates from heuristics or future ML — not confirmed tags.
 * Lifecycle: suggested → accepted (converted to `shot_events`) | rejected.
 */
export const suggestedShotEvents = pgTable(
  "suggested_shot_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    timestampSeconds: doublePrecision("timestamp_seconds").notNull(),
    confidence: real("confidence").notNull(),
    source: suggestedShotSourceEnum("source").notNull().default("heuristic_v1"),
    status: suggestedShotStatusEnum("status").notNull().default("suggested"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    videoStatusIdx: index("suggested_shot_events_video_status_idx").on(table.videoId, table.status),
    videoTsIdx: index("suggested_shot_events_video_ts_idx").on(table.videoId, table.timestampSeconds),
  }),
);

export type SuggestedShotEventRow = typeof suggestedShotEvents.$inferSelect;
export type NewSuggestedShotEventRow = typeof suggestedShotEvents.$inferInsert;
