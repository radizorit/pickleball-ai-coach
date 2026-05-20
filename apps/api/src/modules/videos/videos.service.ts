import type { Video } from "@pickleball/db/schema";
import { and, desc, eq, getDb, inArray, isNull, sql } from "@pickleball/db";
import type {
  VideoDTO,
  VideoPresignedReadDTO,
  VideoPresignedUploadDTO,
  VideoResetLabelsSummaryDTO,
} from "@pickleball/shared";
import type { AcceptedVideoMimeType, VideoReadAsset } from "@pickleball/shared/constants";
import { DEFAULT_MAX_VIDEO_UPLOAD_BYTES } from "@pickleball/shared/constants";
import type {
  CreateVideoBody,
  PatchVideoBody,
  PresignVideoUploadBody,
  UpsertCourtCornersBody,
} from "@pickleball/shared/zod";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  rallies,
  shotEvents,
  suggestedRallies,
  suggestedShotEvents,
  videoSideSwitches,
  videos,
} from "@pickleball/db/schema";

import type { AuthContext } from "../../auth/auth.types.js";
import { loadEnv } from "../../env.js";
import { OBJECT_STORAGE_PORT } from "../../storage/object-storage.port.js";
import type { ObjectStoragePort } from "../../storage/object-storage.port.js";
import { UsersService } from "../users/users.service.js";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function extensionForMime(contentType: AcceptedVideoMimeType): string {
  switch (contentType) {
    case "video/mp4":
      return ".mp4";
    case "video/quicktime":
      return ".mov";
    case "video/x-matroska":
      return ".mkv";
    case "video/webm":
      return ".webm";
    default:
      return ".bin";
  }
}

function storageProviderFromEndpoint(): "r2" | "s3" {
  const ep = loadEnv().S3_ENDPOINT ?? "";
  return ep.includes("r2.cloudflarestorage.com") ? "r2" : "s3";
}

function toVideoDTO(row: Video): VideoDTO {
  return {
    id: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    title: row.title,
    description: row.description ?? null,
    youtubeUrl: row.youtubeUrl ?? null,
    originalFilename: row.originalFilename ?? null,
    contentType: row.contentType ?? null,
    storageProvider: row.storageProvider ?? null,
    storageBucket: row.storageBucket ?? null,
    storageObjectKey: row.storageObjectKey ?? null,
    thumbnailObjectKey: row.thumbnailObjectKey ?? null,
    durationSeconds: row.durationSeconds ?? null,
    fps: row.fps ?? null,
    width: row.width ?? null,
    height: row.height ?? null,
    fileSizeBytes: row.fileSizeBytes ?? null,
    processingStatus: row.processingStatus,
    failureMessage: row.failureMessage ?? null,
    privacy: row.privacy,
    matchType: row.matchType ?? null,
    courtCorners: row.courtCorners ?? null,
    focusPlayerSlot: row.focusPlayerSlot ?? "player_1",
    recordedAt: row.recordedAt ? toIso(row.recordedAt) : null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

@Injectable()
export class VideosService {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(OBJECT_STORAGE_PORT) private readonly objectStorage: ObjectStoragePort,
  ) {}

  async listForUser(auth: AuthContext): Promise<VideoDTO[]> {
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const rows = await db
      .select()
      .from(videos)
      .where(and(eq(videos.userId, userId), isNull(videos.deletedAt)))
      .orderBy(desc(videos.createdAt));
    return rows.map(toVideoDTO);
  }

  async getForUser(auth: AuthContext, videoId: string): Promise<VideoDTO> {
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const [row] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId), isNull(videos.deletedAt)))
      .limit(1);
    if (!row) {
      throw new NotFoundException("Video not found");
    }
    return toVideoDTO(row);
  }

  async create(auth: AuthContext, body: CreateVideoBody): Promise<VideoDTO> {
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const youtube = body.youtubeUrl?.trim();

    if (youtube) {
      let title = body.title.trim();
      try {
        const oembedUrl = `https://www.youtube.com/oembed?${new URLSearchParams({
          url: youtube,
          format: "json",
        })}`;
        const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const j = (await res.json()) as { title?: string };
          if (typeof j.title === "string" && j.title.trim().length > 0) {
            title = j.title.trim().slice(0, 200);
          }
        }
      } catch {
        // Non-fatal: keep client-provided title
      }

      const [row] = await db
        .insert(videos)
        .values({
          userId,
          organizationId: null,
          title,
          description: body.description ?? null,
          privacy: body.privacy ?? "private",
          youtubeUrl: youtube,
          originalFilename: null,
          contentType: null,
          processingStatus: "ready",
        })
        .returning();
      if (!row) {
        throw new BadRequestException("Could not create video record");
      }
      return toVideoDTO(row);
    }

    const [row] = await db
      .insert(videos)
      .values({
        userId,
        organizationId: null,
        title: body.title.trim(),
        description: body.description ?? null,
        privacy: body.privacy ?? "private",
        originalFilename: body.originalFilename ?? null,
        contentType: body.contentType ?? null,
        processingStatus: "pending",
      })
      .returning();
    if (!row) {
      throw new BadRequestException("Could not create video record");
    }
    return toVideoDTO(row);
  }

  async presignUpload(
    auth: AuthContext,
    videoId: string,
    body: PresignVideoUploadBody,
  ): Promise<VideoPresignedUploadDTO> {
    const env = loadEnv();
    if (!this.objectStorage.isUploadConfigured()) {
      throw new ServiceUnavailableException(
        "Object storage is not configured (set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_REGION or S3_ENDPOINT).",
      );
    }
    const maxBytes = Math.min(env.MAX_VIDEO_UPLOAD_BYTES, DEFAULT_MAX_VIDEO_UPLOAD_BYTES);
    if (body.fileSizeBytes > maxBytes) {
      throw new BadRequestException(`fileSizeBytes exceeds limit of ${maxBytes} bytes`);
    }

    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const [row] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId), isNull(videos.deletedAt)))
      .limit(1);
    if (!row) {
      throw new NotFoundException("Video not found");
    }
    if (row.youtubeUrl) {
      throw new ConflictException("This video uses a YouTube link; file upload is not available.");
    }
    if (row.processingStatus !== "pending") {
      throw new ConflictException("Video is not in pending state; cannot start a new upload.");
    }

    const bucket = env.S3_BUCKET!;
    const ext = extensionForMime(body.contentType);
    const objectKey = `videos/${userId}/${videoId}${ext}`;
    const provider = storageProviderFromEndpoint();

    const signed = await this.objectStorage.presignPut({
      objectKey,
      contentType: body.contentType,
      contentLength: body.fileSizeBytes,
      expiresInSeconds: env.PRESIGNED_UPLOAD_EXPIRES_SECONDS,
    });

    const [updated] = await db
      .update(videos)
      .set({
        processingStatus: "uploading",
        storageProvider: provider,
        storageBucket: bucket,
        storageObjectKey: objectKey,
        contentType: body.contentType,
        originalFilename: body.originalFilename,
        fileSizeBytes: body.fileSizeBytes,
        failureMessage: null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId)))
      .returning();

    if (!updated) {
      throw new BadRequestException("Could not update video for upload");
    }

    return {
      upload: {
        method: signed.method,
        url: signed.url,
        requiredHeaders: signed.requiredHeaders,
        expiresAt: signed.expiresAt,
      },
      video: toVideoDTO(updated),
    };
  }

  async completeUpload(auth: AuthContext, videoId: string): Promise<VideoDTO> {
    if (!this.objectStorage.isUploadConfigured()) {
      throw new ServiceUnavailableException("Object storage is not configured.");
    }

    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const [row] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId), isNull(videos.deletedAt)))
      .limit(1);
    if (!row) {
      throw new NotFoundException("Video not found");
    }
    if (row.youtubeUrl) {
      throw new ConflictException("This video uses a YouTube link; upload completion does not apply.");
    }
    if (row.processingStatus !== "uploading") {
      throw new ConflictException("Video is not awaiting upload completion.");
    }
    if (!row.storageObjectKey || row.fileSizeBytes == null) {
      throw new BadRequestException("Video is missing storage metadata");
    }

    const head = await this.objectStorage.headObject(row.storageObjectKey);
    if (!head) {
      throw new BadRequestException("Object not found in storage yet");
    }
    if (head.contentLength !== row.fileSizeBytes) {
      throw new BadRequestException("Uploaded size does not match declared file size");
    }

    const [updated] = await db
      .update(videos)
      .set({
        processingStatus: "uploaded",
        failureMessage: null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId)))
      .returning();

    if (!updated) {
      throw new BadRequestException("Could not finalize upload");
    }
    return toVideoDTO(updated);
  }

  async presignReadForUser(
    auth: AuthContext,
    videoId: string,
    asset: VideoReadAsset,
  ): Promise<VideoPresignedReadDTO> {
    const env = loadEnv();
    const expiresSeconds = env.PRESIGNED_READ_EXPIRES_SECONDS;

    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const [row] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId), isNull(videos.deletedAt)))
      .limit(1);
    if (!row) {
      throw new NotFoundException("Video not found");
    }

    if (row.youtubeUrl) {
      if (asset === "source") {
        throw new ConflictException("This video uses YouTube embed playback; there is no signed source URL.");
      }
      throw new ConflictException(
        "YouTube-linked videos use the public thumbnail at https://img.youtube.com/vi/<id>/maxresdefault.jpg (parse id from youtubeUrl on the client).",
      );
    }

    if (!this.objectStorage.isUploadConfigured()) {
      throw new ServiceUnavailableException(
        "Object storage is not configured (set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_REGION or S3_ENDPOINT).",
      );
    }

    if (asset === "thumbnail") {
      if (!row.thumbnailObjectKey || row.processingStatus !== "ready") {
        throw new ConflictException("Poster is not available yet.");
      }
      const signed = await this.objectStorage.presignGet({
        objectKey: row.thumbnailObjectKey,
        expiresInSeconds: expiresSeconds,
        responseContentType: "image/jpeg",
      });
      return { url: signed.url, expiresAt: signed.expiresAt };
    }

    const sourceOk =
      row.processingStatus === "uploaded" ||
      row.processingStatus === "processing" ||
      row.processingStatus === "ready" ||
      row.processingStatus === "failed";
    if (!sourceOk) {
      throw new ConflictException("Video file is not available for playback yet.");
    }
    if (!row.storageObjectKey) {
      throw new BadRequestException("Video object is missing.");
    }

    const responseContentType =
      row.contentType && row.contentType.length > 0 ? row.contentType : "application/octet-stream";

    const signed = await this.objectStorage.presignGet({
      objectKey: row.storageObjectKey,
      expiresInSeconds: expiresSeconds,
      responseContentType,
    });
    return { url: signed.url, expiresAt: signed.expiresAt };
  }

  async patchVideo(auth: AuthContext, videoId: string, body: PatchVideoBody): Promise<VideoDTO> {
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    if (body.focusPlayerSlot === undefined) {
      return this.getForUser(auth, videoId);
    }
    const [updated] = await db
      .update(videos)
      .set({ focusPlayerSlot: body.focusPlayerSlot, updatedAt: sql`now()` })
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId), isNull(videos.deletedAt)))
      .returning();
    if (!updated) {
      throw new NotFoundException("Video not found");
    }
    return toVideoDTO(updated);
  }

  async upsertCourtCorners(
    auth: AuthContext,
    videoId: string,
    body: UpsertCourtCornersBody,
  ): Promise<VideoDTO> {
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const [updated] = await db
      .update(videos)
      .set({ courtCorners: body.courtCorners, updatedAt: sql`now()` })
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId), isNull(videos.deletedAt)))
      .returning();
    if (!updated) {
      throw new NotFoundException("Video not found");
    }
    return toVideoDTO(updated);
  }

  /**
   * Clear manual labels for a fresh gold session: shots, rallies, side switches.
   * Optionally reset accepted/rejected suggestions back to `suggested`.
   */
  async resetLabelsForVideo(
    auth: AuthContext,
    videoId: string,
    options?: { resetSuggestions?: boolean },
  ): Promise<VideoResetLabelsSummaryDTO> {
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const resetSuggestions = options?.resetSuggestions !== false;

    const [video] = await db
      .select({ id: videos.id })
      .from(videos)
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId), isNull(videos.deletedAt)))
      .limit(1);
    if (!video) {
      throw new NotFoundException("Video not found");
    }

    return db.transaction(async (tx) => {
      const deletedShots = await tx
        .delete(shotEvents)
        .where(eq(shotEvents.videoId, videoId))
        .returning({ id: shotEvents.id });
      const deletedRallies = await tx
        .delete(rallies)
        .where(eq(rallies.videoId, videoId))
        .returning({ id: rallies.id });
      const deletedSideSwitches = await tx
        .delete(videoSideSwitches)
        .where(eq(videoSideSwitches.videoId, videoId))
        .returning({ id: videoSideSwitches.id });

      let resetShotSuggestions = 0;
      let resetRallySuggestions = 0;
      if (resetSuggestions) {
        const shotSug = await tx
          .update(suggestedShotEvents)
          .set({ status: "suggested", updatedAt: sql`now()` })
          .where(
            and(
              eq(suggestedShotEvents.videoId, videoId),
              inArray(suggestedShotEvents.status, ["accepted", "rejected"]),
            ),
          )
          .returning({ id: suggestedShotEvents.id });
        resetShotSuggestions = shotSug.length;

        const rallySug = await tx
          .update(suggestedRallies)
          .set({ status: "suggested", updatedAt: sql`now()` })
          .where(
            and(
              eq(suggestedRallies.videoId, videoId),
              inArray(suggestedRallies.status, ["accepted", "rejected"]),
            ),
          )
          .returning({ id: suggestedRallies.id });
        resetRallySuggestions = rallySug.length;
      }

      return {
        deletedShots: deletedShots.length,
        deletedRallies: deletedRallies.length,
        deletedSideSwitches: deletedSideSwitches.length,
        resetShotSuggestions,
        resetRallySuggestions,
      };
    });
  }
}
