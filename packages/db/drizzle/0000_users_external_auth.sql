-- Adds external identity columns for Clerk (or future providers).
-- Safe to re-run on partially-migrated databases (IF NOT EXISTS).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "external_auth_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "external_auth_provider" text NOT NULL DEFAULT 'clerk';

CREATE UNIQUE INDEX IF NOT EXISTS "users_external_auth_id_unique" ON "users" ("external_auth_id");
