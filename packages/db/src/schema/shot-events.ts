import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
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
  videoPlayerSlotEnum,
} from "./enums.js";
import { rallies } from "./rallies.js";
import { suggestedShotEvents } from "./suggested-shot-events.js";
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
    rallyId: uuid("rally_id").references(() => rallies.id, { onDelete: "set null" }),
    playerSlot: videoPlayerSlotEnum("player_slot"),
    shotIndexInRally: integer("shot_index_in_rally"),
    endsRally: boolean("ends_rally").notNull().default(false),
    timestampSeconds: doublePrecision("timestamp_seconds").notNull(),
    shotType: shotTypeEnum("shot_type").notNull(),
    side: shotSideEnum("shot_side").notNull(),
    outcome: shotOutcomeEnum("shot_outcome").notNull(),
    note: text("note"),
    source: shotEventSourceEnum("source").notNull().default("manual"),
    suggestedShotEventId: uuid("suggested_shot_event_id").references(() => suggestedShotEvents.id, {
      onDelete: "set null",
    }),
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
    suggestedShotIdx: index("shot_events_suggested_shot_event_id_idx").on(table.suggestedShotEventId),
    rallyIdx: index("shot_events_rally_idx").on(table.rallyId, table.shotIndexInRally),
  }),
);

export type ShotEventRow = typeof shotEvents.$inferSelect;
export type NewShotEventRow = typeof shotEvents.$inferInsert;
