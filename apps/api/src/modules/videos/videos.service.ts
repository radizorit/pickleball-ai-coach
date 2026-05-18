import type { Video } from "@pickleball/db/schema";
import { and, desc, eq, getDb, isNull, sql } from "@pickleball/db";
import type { VideoDTO, VideoPresignedUploadDTO } from "@pickleball/shared";
import type { AcceptedVideoMimeType } from "@pickleball/shared/constants";
import { DEFAULT_MAX_VIDEO_UPLOAD_BYTES } from "@pickleball/shared/constants";
import type { CreateVideoBody, PresignVideoUploadBody } from "@pickleball/shared/zod";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { videos } from "@pickleball/db/schema";

import type { AuthContext } from "../../auth/auth.types.js";
import { loadEnv } from "../../env.js";
import { OBJECT_STORAGE_PORT } from "../../storage/object-storage.port.js";
import type { ObjectStoragePort } from "../../storage/object-storage.port.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest injects UsersService by class reference
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
    originalFilename: row.originalFilename ?? null,
    contentType: row.contentType ?? null,
    storageProvider: row.storageProvider ?? null,
    storageBucket: row.storageBucket ?? null,
    storageObjectKey: row.storageObjectKey ?? null,
    durationSeconds: row.durationSeconds ?? null,
    fps: row.fps ?? null,
    width: row.width ?? null,
    height: row.height ?? null,
    fileSizeBytes: row.fileSizeBytes ?? null,
    processingStatus: row.processingStatus,
    failureMessage: row.failureMessage ?? null,
    privacy: row.privacy,
    matchType: row.matchType ?? null,
    recordedAt: row.recordedAt ? toIso(row.recordedAt) : null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

@Injectable()
export class VideosService {
  constructor(
    private readonly users: UsersService,
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
}
