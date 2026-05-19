import type {
  MatchType,
  Plan,
  ProcessingStatus,
  RallyResult,
  ShotEventSource,
  ShotOutcome,
  ShotSide,
  ShotType,
  SuggestedShotSource,
  SuggestedShotStatus,
  Team,
  TeamPosition,
  VideoPrivacy,
} from "../constants/index.js";

/**
 * Plain-object DTOs used across the network boundary (API <-> web, and later
 * API <-> mobile). These mirror the DB schema but live here so any client
 * can share a single type vocabulary without depending on Drizzle.
 *
 * Convention:
 * - IDs are strings (UUIDs).
 * - Timestamps are ISO-8601 strings, NEVER Date objects (Dates don't survive
 *   JSON serialization round-trips).
 * - Optional nullable columns are typed `T | null`, not `T | undefined`,
 *   matching what Postgres returns.
 */

export interface UserDTO {
  id: string;
  externalAuthId: string | null;
  externalAuthProvider: string | null;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  defaultOrgId: string | null;
  createdAt: string;
}

export interface OrganizationDTO {
  id: string;
  name: string;
  plan: Plan;
  createdAt: string;
}

export interface VideoDTO {
  id: string;
  userId: string;
  /** Nullable until personal-org provisioning links videos to an org. */
  organizationId: string | null;
  title: string;
  description: string | null;
  /** When set, playback uses YouTube embed (no signed S3 source URL). */
  youtubeUrl: string | null;
  originalFilename: string | null;
  contentType: string | null;
  /** Opaque provider id (e.g. `r2`, `s3`); null until an adapter writes keys. */
  storageProvider: string | null;
  storageBucket: string | null;
  storageObjectKey: string | null;
  /** Poster in object storage (same bucket as source). */
  thumbnailObjectKey: string | null;
  durationSeconds: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  fileSizeBytes: number | null;
  processingStatus: ProcessingStatus;
  failureMessage: string | null;
  privacy: VideoPrivacy;
  matchType: MatchType | null;
  recordedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Short-lived signed GET for private media (`GET /v1/videos/:id/read-url`). */
export interface VideoPresignedReadDTO {
  url: string;
  expiresAt: string;
}

export interface VideoPresignedUploadDTO {
  upload: {
    method: "PUT";
    url: string;
    requiredHeaders: Record<string, string>;
    expiresAt: string;
  };
  video: VideoDTO;
}

export interface MatchDTO {
  id: string;
  videoId: string;
  title: string;
  matchType: MatchType;
  playedAt: string | null;
  createdAt: string;
}

export interface MatchParticipantDTO {
  id: string;
  matchId: string;
  displayName: string;
  linkedUserId: string | null;
  team: Team;
  position: TeamPosition | null;
  isSelf: boolean;
}

export interface RallyDTO {
  id: string;
  matchId: string;
  videoId: string;
  startTimeMs: number;
  endTimeMs: number;
  servingTeam: Team;
  servingParticipantId: string | null;
  rallyLength: number | null;
  winningTeam: Team | null;
  result: RallyResult | null;
}

/**
 * Manual (or future AI) shot tag on a video. Timestamps are in seconds to align
 * with HTMLMediaElement.currentTime and worker-derived `durationSeconds`.
 */
export interface ShotEventDTO {
  id: string;
  videoId: string;
  rallyId: string | null;
  timestampSeconds: number;
  shotType: ShotType;
  side: ShotSide;
  outcome: ShotOutcome;
  note: string | null;
  source: ShotEventSource;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

/** Heuristic (or future ML) shot moment candidate — not a confirmed tag until converted. */
export interface SuggestedShotEventDTO {
  id: string;
  videoId: string;
  timestampSeconds: number;
  confidence: number;
  source: SuggestedShotSource;
  status: SuggestedShotStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Standard error envelope returned by the API on non-2xx responses.
 * Clients (web, mobile) should narrow on `code` to render localized copy.
 */
export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
