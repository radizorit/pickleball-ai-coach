import { sql } from "drizzle-orm";
import { doublePrecision, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users.js";
import { videos } from "./videos.js";

/** User-marked court end switches (fixed camera; Me stays player_1). */
export const videoSideSwitches = pgTable(
  "video_side_switches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    timestampSeconds: doublePrecision("timestamp_seconds").notNull(),
    note: text("note"),
    segmentIndex: integer("segment_index"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    videoTimestampIdx: index("video_side_switches_video_timestamp_idx").on(
      table.videoId,
      table.timestampSeconds,
    ),
  }),
);

export type VideoSideSwitchRow = typeof videoSideSwitches.$inferSelect;
export type NewVideoSideSwitchRow = typeof videoSideSwitches.$inferInsert;
