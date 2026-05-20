ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "focus_player_slot" "video_player_slot" DEFAULT 'player_1' NOT NULL;
