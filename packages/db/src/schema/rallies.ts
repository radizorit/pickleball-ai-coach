import { sql } from "drizzle-orm";
import { doublePrecision, index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { rallyEndReasonEnum, videoPlayerSlotEnum } from "./enums.js";
import { videos } from "./videos.js";

/** Manual rally segment on a video (start/end in seconds). */
export const rallies = pgTable(
  "rallies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    startTimeSeconds: doublePrecision("start_time_seconds").notNull(),
    endTimeSeconds: doublePrecision("end_time_seconds"),
    winningPlayerSlot: videoPlayerSlotEnum("winning_player_slot"),
    endReason: rallyEndReasonEnum("end_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    videoStartIdx: index("rallies_video_start_idx").on(table.videoId, table.startTimeSeconds),
  }),
);

export type RallyRow = typeof rallies.$inferSelect;
export type NewRallyRow = typeof rallies.$inferInsert;
