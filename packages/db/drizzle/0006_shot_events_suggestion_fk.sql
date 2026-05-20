ALTER TABLE "shot_events" ADD COLUMN IF NOT EXISTS "suggested_shot_event_id" uuid;--> statement-breakpoint
ALTER TABLE "shot_events" ADD CONSTRAINT "shot_events_suggested_shot_event_id_suggested_shot_events_id_fk" FOREIGN KEY ("suggested_shot_event_id") REFERENCES "public"."suggested_shot_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shot_events_suggested_shot_event_id_idx" ON "shot_events" USING btree ("suggested_shot_event_id");
