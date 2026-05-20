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
  RALLY_END_REASONS,
  RALLY_RESULTS,
  SHOT_EVENT_SOURCES,
  SHOT_OUTCOMES,
  SHOT_SIDES,
  SHOT_TYPES,
  SUGGESTED_SHOT_SOURCES,
  SUGGESTED_SHOT_STATUSES,
  TEAM_POSITIONS,
  TEAMS,
  VIDEO_PLAYER_SLOTS,
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
export const videoPlayerSlotEnum = pgEnum("video_player_slot", VIDEO_PLAYER_SLOTS);
export const rallyEndReasonEnum = pgEnum("rally_end_reason", RALLY_END_REASONS);
export const shotTypeEnum = pgEnum("shot_type", SHOT_TYPES);
export const shotSideEnum = pgEnum("shot_side", SHOT_SIDES);
export const shotOutcomeEnum = pgEnum("shot_outcome", SHOT_OUTCOMES);
export const courtZoneEnum = pgEnum("court_zone", COURT_ZONES);
export const shotEventSourceEnum = pgEnum("shot_event_source", SHOT_EVENT_SOURCES);
export const suggestedShotSourceEnum = pgEnum("suggested_shot_source", SUGGESTED_SHOT_SOURCES);
export const suggestedShotStatusEnum = pgEnum("suggested_shot_status", SUGGESTED_SHOT_STATUSES);
/** Same lifecycle as suggested shots: suggested → accepted | rejected */
export const suggestedRallyStatusEnum = pgEnum("suggested_rally_status", SUGGESTED_SHOT_STATUSES);
