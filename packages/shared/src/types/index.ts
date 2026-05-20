import type {
  MatchType,
  Plan,
  ProcessingStatus,
  RallyEndReason,
  RallyResult,
  ShotEventSource,
  ShotOutcome,
  ShotSide,
  ShotType,
  SuggestedShotSource,
  SuggestedShotStatus,
  Team,
  TeamPosition,
  VideoPlayerSlot,
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
  /** Normalized court quad for vision ROI (0–1). */
  courtCorners: VideoCourtCorners | null;
  /** Solo analysis subject slot (convention: player_1 = Me). */
  focusPlayerSlot: VideoPlayerSlot;
  recordedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `POST /v1/videos/:id/reset-labels` — counts cleared for a fresh gold session. */
export interface VideoResetLabelsSummaryDTO {
  deletedShots: number;
  deletedRallies: number;
  deletedSideSwitches: number;
  resetShotSuggestions: number;
  resetRallySuggestions: number;
}

/** Court corners in normalized video coordinates. */
export type VideoCourtCorners = [
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
];

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

/** Future match-centric rally (ms, teams). Not used by video-scoped MVP API. */
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

/** Lightweight player label for a video (`GET/PUT /v1/videos/:id/players`). */
export interface VideoPlayerDTO {
  videoId: string;
  slot: VideoPlayerSlot;
  displayName: string | null;
}

/** Court end switch logged in Review (`GET/POST /v1/videos/:id/side-switches`). */
export interface VideoSideSwitchDTO {
  id: string;
  videoId: string;
  timestampSeconds: number;
  note: string | null;
  segmentIndex: number | null;
  createdAt: string;
}

/** Manual rally segment on a video (seconds, aligned with shot timestamps). */
export interface VideoRallyDTO {
  id: string;
  videoId: string;
  startTimeSeconds: number;
  endTimeSeconds: number | null;
  winningPlayerSlot: VideoPlayerSlot | null;
  endReason: RallyEndReason | null;
  /** Shots tagged in this rally (API-computed). */
  shotCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Manual (or future AI) shot tag on a video. Timestamps are in seconds to align
 * with HTMLMediaElement.currentTime and worker-derived `durationSeconds`.
 */
export interface ShotEventDTO {
  id: string;
  videoId: string;
  rallyId: string | null;
  playerSlot: VideoPlayerSlot | null;
  /** 1-based index within the rally; null when not assigned to a rally. */
  shotIndexInRally: number | null;
  endsRally: boolean;
  timestampSeconds: number;
  shotType: ShotType;
  side: ShotSide;
  outcome: ShotOutcome;
  note: string | null;
  source: ShotEventSource;
  /** Populated when the tag was created from a suggestion (training audit). */
  suggestedShotEventId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

/** `GET /v1/videos/:id/rally-consistency` — derived from rallies + shot tags. */
export interface RallyConsistencyStatsDTO {
  closedRallyCount: number;
  openRallyCount: number;
  averageRallyLength: number | null;
  longestRallyLength: number | null;
  /** Per closed rally with `endReason === error`: shot count in that rally. */
  shotsBeforeError: number[];
  /** Per closed rally with `endReason === winner`: shot count in that rally. */
  shotsBeforeWinner: number[];
  playerWinnerCounts: Record<VideoPlayerSlot, number>;
  playerErrorCounts: Record<VideoPlayerSlot, number>;
}

/** Response from `POST /v1/videos/:id/suggested-shot-events/regenerate`. */
export interface SuggestedShotRegenerateSummaryDTO {
  generatedCount: number;
  averageConfidence: number;
  pendingCount: number;
  acceptedCount: number;
  rejectedCount: number;
}

/** Debug payload from worker heuristics (also persisted in DB `debug_metadata`). */
export interface SuggestedShotDebugMetadata {
  generatedAt: string;
  pipelineVersion?: string;
  sceneScore?: number;
  audioPeak?: number;
  motionScore?: number;
  signalWeights?: { scene: number; audio: number; motion: number };
  rawCandidateCount?: number;
  mergedClusterCount?: number;
  suppressedBelowThreshold?: number;
  suppressedSpacing?: number;
  suppressedMaxCount?: number;
  kind?: "contact" | "rally_start" | "rally_end";
  proposedRallyIndex?: number;
  endOfRallyLikely?: boolean;
  proposedRallyCount?: number;
  contactCount?: number;
}

/** Proposed rally span from heuristic_v3 (human confirms into `VideoRallyDTO`). */
export interface SuggestedRallyDTO {
  id: string;
  videoId: string;
  proposalIndex: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  confidence: number;
  status: SuggestedShotStatus;
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
  reason: string | null;
  audioPeak: number | null;
  motionScore: number | null;
  debugMetadata: SuggestedShotDebugMetadata | null;
  createdAt: string;
  updatedAt: string;
}

/** Video context included in ML training export (no signed URLs or storage secrets). */
export interface VideoTrainingExportVideoMeta {
  videoId: string;
  title: string;
  durationSeconds: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  contentType: string | null;
  originalFilename: string | null;
  processingStatus: ProcessingStatus;
  youtubeUrl: string | null;
  recordedAt: string | null;
}

/** One labeled suggestion row for offline ML training. */
export interface VideoTrainingExportRow {
  suggestionId: string;
  suggestionTimestampSeconds: number;
  confidence: number;
  reason: string | null;
  audioPeak: number | null;
  motionScore: number | null;
  suggestionStatus: SuggestedShotStatus;
  suggestionSource: SuggestedShotSource;
  becameConfirmedShot: boolean;
  confirmedShotEventId: string | null;
  confirmedShotType: ShotType | null;
  confirmedSide: ShotSide | null;
  confirmedOutcome: ShotOutcome | null;
  pipelineVersion: string | null;
  debugKind?: string | null;
  proposedRallyIndex?: number | null;
  endOfRallyLikely?: boolean | null;
}

export interface VideoTrainingExportRallyRow {
  rallyId: string;
  startTimeSeconds: number;
  endTimeSeconds: number | null;
  winningPlayerSlot: VideoPlayerSlot | null;
  endReason: RallyEndReason | null;
  shotCount: number;
}

export interface VideoTrainingExportSuggestedRallyRow {
  suggestedRallyId: string;
  proposalIndex: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  confidence: number;
  status: SuggestedShotStatus;
  acceptedRallyId: string | null;
}

export interface VideoTrainingExportSideSwitchRow {
  id: string;
  timestampSeconds: number;
  note: string | null;
  segmentIndex: number | null;
}

/** `GET /v1/videos/:id/training-export` — owner-scoped JSON dataset. */
export interface VideoTrainingExportDTO {
  schemaVersion: string;
  exportedAt: string;
  video: VideoTrainingExportVideoMeta;
  rows: VideoTrainingExportRow[];
  rallies?: VideoTrainingExportRallyRow[];
  suggestedRallies?: VideoTrainingExportSuggestedRallyRow[];
  sideSwitches?: VideoTrainingExportSideSwitchRow[];
  shots?: Array<{
    shotEventId: string;
    timestampSeconds: number;
    rallyId: string | null;
    playerSlot: VideoPlayerSlot | null;
    shotIndexInRally: number | null;
    endsRally: boolean;
    shotType: ShotType;
    side: ShotSide;
    outcome: ShotOutcome;
  }>;
}

/** Compare suggestion funnel for a video (debug / tuning). */
export interface SuggestedShotStatsDTO {
  suggested: number;
  accepted: number;
  rejected: number;
  avgConfidenceSuggested: number | null;
  avgConfidenceAccepted: number | null;
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
