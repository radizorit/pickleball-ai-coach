CREATE TYPE "public"."suggested_shot_source" AS ENUM('heuristic_v1');--> statement-breakpoint
CREATE TYPE "public"."suggested_shot_status" AS ENUM('suggested', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "suggested_shot_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"timestamp_seconds" double precision NOT NULL,
	"confidence" real NOT NULL,
	"source" "suggested_shot_source" DEFAULT 'heuristic_v1' NOT NULL,
	"status" "suggested_shot_status" DEFAULT 'suggested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "suggested_shot_events" ADD CONSTRAINT "suggested_shot_events_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "suggested_shot_events_video_status_idx" ON "suggested_shot_events" USING btree ("video_id","status");--> statement-breakpoint
CREATE INDEX "suggested_shot_events_video_ts_idx" ON "suggested_shot_events" USING btree ("video_id","timestamp_seconds");
