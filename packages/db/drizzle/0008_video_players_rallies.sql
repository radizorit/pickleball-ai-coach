CREATE TYPE "public"."video_player_slot" AS ENUM('player_1', 'player_2', 'player_3', 'player_4');--> statement-breakpoint
CREATE TYPE "public"."rally_end_reason" AS ENUM('winner', 'error', 'unknown');--> statement-breakpoint
CREATE TABLE "video_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"slot" "video_player_slot" NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "rallies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"start_time_seconds" double precision NOT NULL,
	"end_time_seconds" double precision,
	"winning_player_slot" "video_player_slot",
	"end_reason" "rally_end_reason",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "shot_events" ADD COLUMN IF NOT EXISTS "player_slot" "video_player_slot";--> statement-breakpoint
ALTER TABLE "shot_events" ADD COLUMN IF NOT EXISTS "shot_index_in_rally" integer;--> statement-breakpoint
ALTER TABLE "shot_events" ADD COLUMN IF NOT EXISTS "ends_rally" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "video_players" ADD CONSTRAINT "video_players_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rallies" ADD CONSTRAINT "rallies_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shot_events" ADD CONSTRAINT "shot_events_rally_id_rallies_id_fk" FOREIGN KEY ("rally_id") REFERENCES "public"."rallies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "video_players_video_slot_uq" ON "video_players" USING btree ("video_id","slot");--> statement-breakpoint
CREATE INDEX "rallies_video_start_idx" ON "rallies" USING btree ("video_id","start_time_seconds");--> statement-breakpoint
CREATE INDEX "shot_events_rally_idx" ON "shot_events" USING btree ("rally_id","shot_index_in_rally");
