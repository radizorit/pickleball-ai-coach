import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { suggestedRallyStatusEnum } from "./enums.js";
import { videos } from "./videos.js";

export type SuggestedRallyDebugMetadata = {
  generatedAt?: string;
  pipelineVersion?: string;
  meanEnergy?: number;
};

/** Proposed rally span from heuristic_v3 — human confirms into `rallies`. */
export const suggestedRallies = pgTable(
  "suggested_rallies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    proposalIndex: integer("proposal_index").notNull(),
    startTimeSeconds: doublePrecision("start_time_seconds").notNull(),
    endTimeSeconds: doublePrecision("end_time_seconds").notNull(),
    confidence: real("confidence").notNull(),
    status: suggestedRallyStatusEnum("status").notNull().default("suggested"),
    debugMetadata: jsonb("debug_metadata").$type<SuggestedRallyDebugMetadata>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    videoStatusIdx: index("suggested_rallies_video_status_idx").on(table.videoId, table.status),
    videoStartIdx: index("suggested_rallies_video_start_idx").on(
      table.videoId,
      table.startTimeSeconds,
    ),
  }),
);

export type SuggestedRallyRow = typeof suggestedRallies.$inferSelect;
export type NewSuggestedRallyRow = typeof suggestedRallies.$inferInsert;
