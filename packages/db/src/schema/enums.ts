/**
 * Postgres enums. Values are mirrored from `@pickleball/shared/constants` so
 * the TypeScript union types and the pg type stay in lockstep.
 *
 * When changing values, write a migration that uses ALTER TYPE.
 * drizzle-kit can sometimes regenerate enums in a way that loses data; we
 * intentionally hand-write enum migrations once they're in production.
 */
import { pgEnum } from "drizzle-orm/pg-core";
import {
  COURT_ZONES,
  MATCH_TYPES,
  ORG_ROLES,
  PLANS,
  PROCESSING_STATUSES,
  RALLY_RESULTS,
  SHOT_EVENT_SOURCES,
  SHOT_OUTCOMES,
  SHOT_SIDES,
  SHOT_TYPES,
  TEAM_POSITIONS,
  TEAMS,
  VIDEO_PRIVACY,
} from "@pickleball/shared/constants";

export const planEnum = pgEnum("plan", PLANS);
export const orgRoleEnum = pgEnum("org_role", ORG_ROLES);
export const processingStatusEnum = pgEnum("processing_status", PROCESSING_STATUSES);
export const videoPrivacyEnum = pgEnum("video_privacy", VIDEO_PRIVACY);
export const matchTypeEnum = pgEnum("match_type", MATCH_TYPES);
export const teamEnum = pgEnum("team", TEAMS);
export const teamPositionEnum = pgEnum("team_position", TEAM_POSITIONS);
export const rallyResultEnum = pgEnum("rally_result", RALLY_RESULTS);
export const shotTypeEnum = pgEnum("shot_type", SHOT_TYPES);
export const shotSideEnum = pgEnum("shot_side", SHOT_SIDES);
export const shotOutcomeEnum = pgEnum("shot_outcome", SHOT_OUTCOMES);
export const courtZoneEnum = pgEnum("court_zone", COURT_ZONES);
export const shotEventSourceEnum = pgEnum("shot_event_source", SHOT_EVENT_SOURCES);
