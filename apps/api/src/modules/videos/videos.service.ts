import type { Video } from "@pickleball/db/schema";
import { and, desc, eq, getDb, isNull } from "@pickleball/db";
import type { VideoDTO } from "@pickleball/shared";
import type { CreateVideoBody } from "@pickleball/shared/zod";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { videos } from "@pickleball/db/schema";

import type { AuthContext } from "../../auth/auth.types.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest injects UsersService by class reference
import { UsersService } from "../users/users.service.js";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
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
  constructor(private readonly users: UsersService) {}

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
}
