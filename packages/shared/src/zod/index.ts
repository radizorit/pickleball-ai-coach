import { z } from "zod";

import { isYouTubeWatchUrl } from "../youtube.js";
import {
  ACCEPTED_VIDEO_MIME_TYPES,
  DEFAULT_MAX_VIDEO_UPLOAD_BYTES,
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
  SUGGESTED_SHOT_SOURCES,
  SUGGESTED_SHOT_STATUSES,
  TEAM_POSITIONS,
  TEAMS,
  VIDEO_PRIVACY,
  VIDEO_READ_ASSETS,
} from "../constants/index.js";

/**
 * Zod enums derived from the constant arrays in `../constants`. Keeping both
 * the schema and the union type pinned to the same source array prevents
 * drift between server validation and TypeScript types.
 */
export const zShotType = z.enum(SHOT_TYPES);
export const zShotSide = z.enum(SHOT_SIDES);
export const zShotOutcome = z.enum(SHOT_OUTCOMES);
export const zCourtZone = z.enum(COURT_ZONES);
export const zShotEventSource = z.enum(SHOT_EVENT_SOURCES);
export const zSuggestedShotSource = z.enum(SUGGESTED_SHOT_SOURCES);
export const zSuggestedShotStatus = z.enum(SUGGESTED_SHOT_STATUSES);
export const zMatchType = z.enum(MATCH_TYPES);
export const zTeam = z.enum(TEAMS);
export const zTeamPosition = z.enum(TEAM_POSITIONS);
export const zRallyResult = z.enum(RALLY_RESULTS);
export const zProcessingStatus = z.enum(PROCESSING_STATUSES);
export const zVideoPrivacy = z.enum(VIDEO_PRIVACY);
export const zPlan = z.enum(PLANS);
export const zOrgRole = z.enum(ORG_ROLES);

export const zVideoReadAsset = z.enum(VIDEO_READ_ASSETS);

export const zUuid = z.string().uuid();
export const zIsoDateTime = z.string().datetime({ offset: true });

/**
 * Health check response — shared so the API and the web app agree on shape.
 */
export const zHealthResponse = z.object({
  status: z.literal("ok"),
  service: z.string(),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: zIsoDateTime,
});
export type HealthResponse = z.infer<typeof zHealthResponse>;

/**
 * `GET /v1/me` response body — mirrors `UserDTO` for optional client-side parse.
 */
export const zUserDTO = z.object({
  id: zUuid,
  externalAuthId: z.string().nullable(),
  externalAuthProvider: z.string().nullable(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  defaultOrgId: zUuid.nullable(),
  createdAt: zIsoDateTime,
});
export type UserDTOValidated = z.infer<typeof zUserDTO>;

const zAcceptedVideoMime = z.enum(ACCEPTED_VIDEO_MIME_TYPES);

/**
 * `POST /v1/videos` body — validated on the API; clients may reuse for forms.
 */
export const zCreateVideoBody = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000).nullable().optional(),
    privacy: zVideoPrivacy.optional(),
    originalFilename: z.string().max(512).nullable().optional(),
    contentType: zAcceptedVideoMime.nullable().optional(),
    /** When set, creates a YouTube-embed-only row (ready immediately; no upload). */
    youtubeUrl: z.string().trim().url().optional(),
  })
  .superRefine((data, ctx) => {
    const yt = data.youtubeUrl?.trim();
    if (!yt) return;
    if (!isYouTubeWatchUrl(yt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["youtubeUrl"],
        message: "Use a youtube.com or youtu.be watch URL",
      });
    }
  });
export type CreateVideoBody = z.infer<typeof zCreateVideoBody>;

/**
 * Body for `POST /v1/videos/:id/presign` — must match the file the client will PUT.
 */
export const zPresignVideoUploadBody = z.object({
  contentType: zAcceptedVideoMime,
  fileSizeBytes: z.number().int().positive().max(DEFAULT_MAX_VIDEO_UPLOAD_BYTES),
  originalFilename: z.string().min(1).max(512),
});
export type PresignVideoUploadBody = z.infer<typeof zPresignVideoUploadBody>;

/**
 * Mirrors `VideoDTO` for optional client-side response validation.
 */
export const zVideoDTO = z.object({
  id: zUuid,
  userId: zUuid,
  organizationId: zUuid.nullable(),
  title: z.string(),
  description: z.string().nullable(),
  youtubeUrl: z.union([z.string().url(), z.null()]),
  originalFilename: z.string().nullable(),
  contentType: z.string().nullable(),
  storageProvider: z.string().nullable(),
  storageBucket: z.string().nullable(),
  storageObjectKey: z.string().nullable(),
  thumbnailObjectKey: z.string().nullable(),
  durationSeconds: z.number().int().nullable(),
  fps: z.number().int().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  fileSizeBytes: z.number().int().nullable(),
  processingStatus: zProcessingStatus,
  failureMessage: z.string().nullable(),
  privacy: zVideoPrivacy,
  matchType: zMatchType.nullable(),
  recordedAt: zIsoDateTime.nullable(),
  createdAt: zIsoDateTime,
  updatedAt: zIsoDateTime,
});
export const zVideoPresignedUploadDTO = z.object({
  upload: z.object({
    method: z.literal("PUT"),
    url: z.string().url(),
    requiredHeaders: z.record(z.string(), z.string()),
    expiresAt: zIsoDateTime,
  }),
  video: zVideoDTO,
});
export type VideoPresignedUploadDTOValidated = z.infer<typeof zVideoPresignedUploadDTO>;

export const zVideoPresignedReadDTO = z.object({
  url: z.string().url(),
  expiresAt: zIsoDateTime,
});
export type VideoPresignedReadDTOValidated = z.infer<typeof zVideoPresignedReadDTO>;

export type VideoDTOValidated = z.infer<typeof zVideoDTO>;

/** `POST /v1/videos/:id/shot-events` — server sets `source` to `manual`. */
export const zCreateShotEventBody = z.object({
  timestampSeconds: z.number().nonnegative().max(864_000),
  shotType: zShotType,
  side: zShotSide,
  outcome: zShotOutcome,
  note: z.string().max(2000).nullable().optional(),
  rallyId: zUuid.nullable().optional(),
});
export type CreateShotEventBody = z.infer<typeof zCreateShotEventBody>;

/** `PATCH /v1/shot-events/:eventId` — at least one field required. */
export const zUpdateShotEventBody = z
  .object({
    timestampSeconds: z.number().nonnegative().max(864_000).optional(),
    shotType: zShotType.optional(),
    side: zShotSide.optional(),
    outcome: zShotOutcome.optional(),
    note: z.string().max(2000).nullable().optional(),
    rallyId: zUuid.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const has =
      data.timestampSeconds !== undefined ||
      data.shotType !== undefined ||
      data.side !== undefined ||
      data.outcome !== undefined ||
      data.note !== undefined ||
      data.rallyId !== undefined;
    if (!has) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one field to update",
      });
    }
  });
export type UpdateShotEventBody = z.infer<typeof zUpdateShotEventBody>;

export const zShotEventDTO = z.object({
  id: zUuid,
  videoId: zUuid,
  rallyId: zUuid.nullable(),
  timestampSeconds: z.number(),
  shotType: zShotType,
  side: zShotSide,
  outcome: zShotOutcome,
  note: z.string().nullable(),
  source: zShotEventSource,
  suggestedShotEventId: zUuid.nullable(),
  createdByUserId: zUuid,
  createdAt: zIsoDateTime,
  updatedAt: zIsoDateTime,
});
export type ShotEventDTOValidated = z.infer<typeof zShotEventDTO>;

export const zSuggestedShotRegenerateSummaryDTO = z.object({
  generatedCount: z.number().int().nonnegative(),
  averageConfidence: z.number().min(0).max(1),
  pendingCount: z.number().int().nonnegative(),
  acceptedCount: z.number().int().nonnegative(),
  rejectedCount: z.number().int().nonnegative(),
});
export type SuggestedShotRegenerateSummaryDTOValidated = z.infer<
  typeof zSuggestedShotRegenerateSummaryDTO
>;

export const zSuggestedShotDebugMetadata = z.object({
  generatedAt: zIsoDateTime,
  pipelineVersion: z.string().optional(),
  sceneScore: z.number().optional(),
  audioPeak: z.number().optional(),
  motionScore: z.number().optional(),
  signalWeights: z
    .object({
      scene: z.number(),
      audio: z.number(),
      motion: z.number(),
    })
    .optional(),
  rawCandidateCount: z.number().int().nonnegative().optional(),
  mergedClusterCount: z.number().int().nonnegative().optional(),
  suppressedBelowThreshold: z.number().int().nonnegative().optional(),
  suppressedSpacing: z.number().int().nonnegative().optional(),
  suppressedMaxCount: z.number().int().nonnegative().optional(),
});

export const zSuggestedShotEventDTO = z.object({
  id: zUuid,
  videoId: zUuid,
  timestampSeconds: z.number(),
  confidence: z.number().min(0).max(1),
  source: zSuggestedShotSource,
  status: zSuggestedShotStatus,
  reason: z.string().nullable(),
  audioPeak: z.number().nullable(),
  motionScore: z.number().nullable(),
  debugMetadata: zSuggestedShotDebugMetadata.nullable(),
  createdAt: zIsoDateTime,
  updatedAt: zIsoDateTime,
});
export type SuggestedShotEventDTOValidated = z.infer<typeof zSuggestedShotEventDTO>;

export const zSuggestedShotStatsDTO = z.object({
  suggested: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  avgConfidenceSuggested: z.number().min(0).max(1).nullable(),
  avgConfidenceAccepted: z.number().min(0).max(1).nullable(),
});
export type SuggestedShotStatsDTOValidated = z.infer<typeof zSuggestedShotStatsDTO>;

export const zConvertSuggestedShotBatchBody = z.object({
  minConfidence: z.number().min(0).max(1),
});
export type ConvertSuggestedShotBatchBody = z.infer<typeof zConvertSuggestedShotBatchBody>;

/** `PATCH /v1/suggested-shot-events/:id` — dismiss a pending suggestion. */
export const zUpdateSuggestedShotBody = z.object({
  status: z.literal("rejected"),
});
export type UpdateSuggestedShotBody = z.infer<typeof zUpdateSuggestedShotBody>;

/** `POST .../convert` — optional classification; defaults applied server-side to `unknown` if omitted. */
export const zConvertSuggestedShotBody = z.object({
  shotType: zShotType.optional(),
  side: zShotSide.optional(),
  outcome: zShotOutcome.optional(),
  note: z.string().max(2000).nullable().optional(),
});
export type ConvertSuggestedShotBody = z.infer<typeof zConvertSuggestedShotBody>;

export const zSuggestedShotListFilter = z.union([zSuggestedShotStatus, z.literal("all")]);
export type SuggestedShotListFilterValidated = z.infer<typeof zSuggestedShotListFilter>;
