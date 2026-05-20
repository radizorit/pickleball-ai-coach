import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { videoPlayerSlotEnum } from "./enums.js";
import { videos } from "./videos.js";

/** Display labels for player slots on a video (singles: player_1 / player_2). */
export const videoPlayers = pgTable(
  "video_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    slot: videoPlayerSlotEnum("slot").notNull(),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    videoSlotUq: uniqueIndex("video_players_video_slot_uq").on(table.videoId, table.slot),
  }),
);

export type VideoPlayerRow = typeof videoPlayers.$inferSelect;
export type NewVideoPlayerRow = typeof videoPlayers.$inferInsert;
