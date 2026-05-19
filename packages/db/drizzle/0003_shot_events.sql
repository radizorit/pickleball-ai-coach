ALTER TYPE "public"."shot_type" ADD VALUE IF NOT EXISTS 'unknown';--> statement-breakpoint
ALTER TYPE "public"."shot_outcome" ADD VALUE IF NOT EXISTS 'unknown';--> statement-breakpoint
ALTER TYPE "public"."shot_side" ADD VALUE IF NOT EXISTS 'unknown';--> statement-breakpoint
CREATE TABLE "shot_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"rally_id" uuid,
	"timestamp_seconds" double precision NOT NULL,
	"shot_type" "shot_type" NOT NULL,
	"shot_side" "shot_side" NOT NULL,
	"shot_outcome" "shot_outcome" NOT NULL,
	"note" text,
	"source" "shot_event_source" DEFAULT 'manual' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "shot_events" ADD CONSTRAINT "shot_events_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shot_events" ADD CONSTRAINT "shot_events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shot_events_video_timestamp_idx" ON "shot_events" USING btree ("video_id","timestamp_seconds");--> statement-breakpoint
CREATE INDEX "shot_events_video_created_idx" ON "shot_events" USING btree ("video_id","created_at");
