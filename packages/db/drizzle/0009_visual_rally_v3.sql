ALTER TYPE "public"."suggested_shot_source" ADD VALUE IF NOT EXISTS 'heuristic_v3';--> statement-breakpoint
CREATE TYPE "public"."suggested_rally_status" AS ENUM('suggested', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "suggested_rallies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"proposal_index" integer NOT NULL,
	"start_time_seconds" double precision NOT NULL,
	"end_time_seconds" double precision NOT NULL,
	"confidence" real NOT NULL,
	"status" "suggested_rally_status" DEFAULT 'suggested' NOT NULL,
	"debug_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "court_corners" jsonb;--> statement-breakpoint
ALTER TABLE "suggested_rallies" ADD CONSTRAINT "suggested_rallies_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "suggested_rallies_video_status_idx" ON "suggested_rallies" USING btree ("video_id","status");--> statement-breakpoint
CREATE INDEX "suggested_rallies_video_start_idx" ON "suggested_rallies" USING btree ("video_id","start_time_seconds");
