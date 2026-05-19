-- Optional YouTube watch URL (embed playback; no S3 source for this path).
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "youtube_url" text;
