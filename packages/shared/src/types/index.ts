import type {
  CourtZone,
  MatchType,
  Plan,
  ProcessingStatus,
  RallyResult,
  ShotEventSource,
  ShotOutcome,
  ShotSide,
  ShotType,
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
  organizationId: string;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  fileSizeBytes: number | null;
  processingStatus: ProcessingStatus;
  privacy: VideoPrivacy;
  matchType: MatchType | null;
  recordedAt: string | null;
  createdAt: string;
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

export interface ShotEventDTO {
  id: string;
  videoId: string;
  matchId: string;
  rallyId: string | null;
  timestampMs: number;
  participantId: string;
  shotType: ShotType;
  side: ShotSide;
  outcome: ShotOutcome;
  courtZone: CourtZone;
  confidenceScore: number;
  source: ShotEventSource;
  createdByUserId: string | null;
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
