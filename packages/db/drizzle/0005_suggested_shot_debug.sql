ALTER TABLE "suggested_shot_events" ADD COLUMN IF NOT EXISTS "reason" text;--> statement-breakpoint
ALTER TABLE "suggested_shot_events" ADD COLUMN IF NOT EXISTS "audio_peak" real;--> statement-breakpoint
ALTER TABLE "suggested_shot_events" ADD COLUMN IF NOT EXISTS "motion_score" real;--> statement-breakpoint
ALTER TABLE "suggested_shot_events" ADD COLUMN IF NOT EXISTS "debug_metadata" jsonb;
