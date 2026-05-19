/**
 * Domain enums and constants. Kept as `as const` arrays so we can derive
 * both the TypeScript union type and a runtime list (needed by Drizzle's
 * pgEnum and Zod's z.enum from the same source of truth).
 *
 * Everything in this file is pure data — no runtime side effects, no
 * dependencies on app code. Consumed by `@pickleball/db` (schema enums),
 * `@pickleball/shared/zod` (validators), and any client building UI from
 * the catalog of shot types / outcomes.
 */

export const SHOT_TYPES = [
  "serve",
  "return",
  "forehand",
  "backhand",
  "dink",
  "volley",
  "drive",
  "drop",
  "third_shot_drop",
  "reset",
  "lob",
  "overhead",
  /** Manual tagging fallback when the shot shape is unclear. */
  "unknown",
] as const;
export type ShotType = (typeof SHOT_TYPES)[number];

export const SHOT_SIDES = ["forehand", "backhand", "n_a", "unknown"] as const;
export type ShotSide = (typeof SHOT_SIDES)[number];

export const SHOT_OUTCOMES = [
  "in",
  "out",
  "net",
  "winner",
  "forced_error",
  "unforced_error",
  "unknown",
] as const;
export type ShotOutcome = (typeof SHOT_OUTCOMES)[number];

export const COURT_ZONES = [
  "nvz_left",
  "nvz_right",
  "mid_left",
  "mid_right",
  "baseline_left",
  "baseline_right",
  "unknown",
] as const;
export type CourtZone = (typeof COURT_ZONES)[number];

export const SHOT_EVENT_SOURCES = ["manual", "ai_suggested", "ai_accepted", "ai_edited"] as const;
export type ShotEventSource = (typeof SHOT_EVENT_SOURCES)[number];

export const MATCH_TYPES = ["singles", "doubles"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export const TEAMS = ["A", "B"] as const;
export type Team = (typeof TEAMS)[number];

export const TEAM_POSITIONS = ["left", "right"] as const;
export type TeamPosition = (typeof TEAM_POSITIONS)[number];

export const RALLY_RESULTS = ["winner", "forced_error", "unforced_error", "let", "fault"] as const;
export type RallyResult = (typeof RALLY_RESULTS)[number];

/** Full video lifecycle: DB row → client upload → object stored → worker → playable (or failed). */
export const PROCESSING_STATUSES = [
  "pending",
  "uploading",
  "uploaded",
  "processing",
  "ready",
  "failed",
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

/** Which object a presigned GET targets (`GET /v1/videos/:id/read-url?asset=…`). */
export const VIDEO_READ_ASSETS = ["source", "thumbnail"] as const;
export type VideoReadAsset = (typeof VIDEO_READ_ASSETS)[number];

export const VIDEO_PRIVACY = ["private", "unlisted", "shared"] as const;
export type VideoPrivacy = (typeof VIDEO_PRIVACY)[number];

export const PLANS = ["free", "pro", "coach", "club"] as const;
export type Plan = (typeof PLANS)[number];

export const ORG_ROLES = ["owner", "coach", "player"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ACCEPTED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-matroska",
  "video/webm",
] as const;
export type AcceptedVideoMimeType = (typeof ACCEPTED_VIDEO_MIME_TYPES)[number];

/** Default max raw video upload size (5 GiB). API may cap lower via env. */
export const DEFAULT_MAX_VIDEO_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
