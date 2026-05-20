CREATE TABLE IF NOT EXISTS "video_side_switches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "video_id" uuid NOT NULL REFERENCES "videos"("id") ON DELETE CASCADE,
  "timestamp_seconds" double precision NOT NULL,
  "note" text,
  "segment_index" integer,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "video_side_switches_video_timestamp_idx"
  ON "video_side_switches" ("video_id", "timestamp_seconds");
