CREATE TYPE "public"."court_zone" AS ENUM('nvz_left', 'nvz_right', 'mid_left', 'mid_right', 'baseline_left', 'baseline_right', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."match_type" AS ENUM('singles', 'doubles');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'coach', 'player');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'pro', 'coach', 'club');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('pending', 'uploading', 'uploaded', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."rally_result" AS ENUM('winner', 'forced_error', 'unforced_error', 'let', 'fault');--> statement-breakpoint
CREATE TYPE "public"."shot_event_source" AS ENUM('manual', 'ai_suggested', 'ai_accepted', 'ai_edited');--> statement-breakpoint
CREATE TYPE "public"."shot_outcome" AS ENUM('in', 'out', 'net', 'winner', 'forced_error', 'unforced_error');--> statement-breakpoint
CREATE TYPE "public"."shot_side" AS ENUM('forehand', 'backhand', 'n_a');--> statement-breakpoint
CREATE TYPE "public"."shot_type" AS ENUM('serve', 'return', 'forehand', 'backhand', 'dink', 'volley', 'drive', 'drop', 'third_shot_drop', 'reset', 'lob', 'overhead');--> statement-breakpoint
CREATE TYPE "public"."team" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TYPE "public"."team_position" AS ENUM('left', 'right');--> statement-breakpoint
CREATE TYPE "public"."video_privacy" AS ENUM('private', 'unlisted', 'shared');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_auth_id" text,
	"external_auth_provider" text DEFAULT 'clerk' NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"default_org_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" DEFAULT 'player' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"original_filename" text,
	"content_type" text,
	"storage_provider" text,
	"storage_bucket" text,
	"storage_object_key" text,
	"duration_seconds" integer,
	"fps" integer,
	"width" integer,
	"height" integer,
	"file_size_bytes" bigint,
	"processing_status" "processing_status" DEFAULT 'pending' NOT NULL,
	"failure_message" text,
	"privacy" "video_privacy" DEFAULT 'private' NOT NULL,
	"match_type" "match_type",
	"recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_external_auth_id_unique" ON "users" USING btree ("external_auth_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "organizations_name_idx" ON "organizations" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_idx" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_id_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "videos_org_created_idx" ON "videos" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "videos_user_created_idx" ON "videos" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "videos_processing_status_idx" ON "videos" USING btree ("processing_status");
