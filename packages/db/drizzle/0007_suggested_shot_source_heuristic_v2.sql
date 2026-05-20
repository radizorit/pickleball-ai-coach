-- Multi-signal pipeline stores rows as heuristic_v2 (v1 label was legacy).
DO $$ BEGIN
  ALTER TYPE "public"."suggested_shot_source" ADD VALUE 'heuristic_v2';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
