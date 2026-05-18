import { z } from "zod";

import {
  ACCEPTED_VIDEO_MIME_TYPES,
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
export const zMatchType = z.enum(MATCH_TYPES);
export const zTeam = z.enum(TEAMS);
export const zTeamPosition = z.enum(TEAM_POSITIONS);
export const zRallyResult = z.enum(RALLY_RESULTS);
export const zProcessingStatus = z.enum(PROCESSING_STATUSES);
export const zVideoPrivacy = z.enum(VIDEO_PRIVACY);
export const zPlan = z.enum(PLANS);
export const zOrgRole = z.enum(ORG_ROLES);

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
export const zCreateVideoBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  privacy: zVideoPrivacy.optional(),
  originalFilename: z.string().max(512).nullable().optional(),
  contentType: zAcceptedVideoMime.nullable().optional(),
});
export type CreateVideoBody = z.infer<typeof zCreateVideoBody>;

/**
 * Mirrors `VideoDTO` for optional client-side response validation.
 */
export const zVideoDTO = z.object({
  id: zUuid,
  userId: zUuid,
  organizationId: zUuid.nullable(),
  title: z.string(),
  description: z.string().nullable(),
  originalFilename: z.string().nullable(),
  contentType: z.string().nullable(),
  storageProvider: z.string().nullable(),
  storageBucket: z.string().nullable(),
  storageObjectKey: z.string().nullable(),
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
export type VideoDTOValidated = z.infer<typeof zVideoDTO>;
