-- Worker: poster thumbnail object key (same S3/R2 bucket as source video).
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "thumbnail_object_key" text;
