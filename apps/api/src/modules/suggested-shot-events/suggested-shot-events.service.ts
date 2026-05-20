import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type {
  ShotEventDTO,
  SuggestedShotEventDTO,
  SuggestedShotRegenerateSummaryDTO,
  SuggestedShotStatsDTO,
  VideoTrainingExportDTO,
} from "@pickleball/shared";
import type { ConvertSuggestedShotBody, ConvertSuggestedShotBatchBody } from "@pickleball/shared/zod";
import { runSuggestionPipeline } from "@pickleball/suggestions";
import { and, asc, eq, getDb, isNull, sql } from "@pickleball/db";
import { shotEvents, suggestedShotEvents, videos } from "@pickleball/db/schema";
import type { SuggestedShotEventRow } from "@pickleball/db/schema";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";

import type { AuthContext } from "../../auth/auth.types.js";
import { loadEnv } from "../../env.js";
import { createS3ClientFromApiEnv, downloadObjectToFile, isS3Configured } from "../../storage/s3-client.js";
import { UsersService } from "../users/users.service.js";
import { shotEventToDto } from "../shot-events/shot-event-mapper.js";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function suggestedToDto(row: SuggestedShotEventRow): SuggestedShotEventDTO {
  return {
    id: row.id,
    videoId: row.videoId,
    timestampSeconds: row.timestampSeconds,
    confidence: row.confidence,
    source: row.source,
    status: row.status,
    reason: row.reason ?? null,
    audioPeak: row.audioPeak ?? null,
    motionScore: row.motionScore ?? null,
    debugMetadata: row.debugMetadata ?? null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export type SuggestedShotListFilter = "suggested" | "accepted" | "rejected" | "all";

@Injectable()
export class SuggestedShotEventsService {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  private async assertVideoOwned(auth: AuthContext, videoId: string): Promise<void> {
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const [row] = await db
      .select({ id: videos.id })
      .from(videos)
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId), isNull(videos.deletedAt)))
      .limit(1);
    if (!row) {
      throw new NotFoundException("Video not found");
    }
  }

  async listForVideo(
    auth: AuthContext,
    videoId: string,
    filter: SuggestedShotListFilter,
  ): Promise<SuggestedShotEventDTO[]> {
    await this.assertVideoOwned(auth, videoId);
    const db = getDb();
    const [v] = await db
      .select({ youtubeUrl: videos.youtubeUrl })
      .from(videos)
      .where(and(eq(videos.id, videoId), isNull(videos.deletedAt)))
      .limit(1);
    if (v?.youtubeUrl) {
      return [];
    }

    const where =
      filter === "all"
        ? eq(suggestedShotEvents.videoId, videoId)
        : and(eq(suggestedShotEvents.videoId, videoId), eq(suggestedShotEvents.status, filter));

    const rows = await db
      .select()
      .from(suggestedShotEvents)
      .where(where)
      .orderBy(asc(suggestedShotEvents.timestampSeconds), asc(suggestedShotEvents.createdAt));

    return rows.map(suggestedToDto);
  }

  async trainingExportForVideo(auth: AuthContext, videoId: string): Promise<VideoTrainingExportDTO> {
    await this.assertVideoOwned(auth, videoId);
    const db = getDb();

    const [video] = await db
      .select({
        id: videos.id,
        title: videos.title,
        durationSeconds: videos.durationSeconds,
        fps: videos.fps,
        width: videos.width,
        height: videos.height,
        contentType: videos.contentType,
        originalFilename: videos.originalFilename,
        processingStatus: videos.processingStatus,
        youtubeUrl: videos.youtubeUrl,
        recordedAt: videos.recordedAt,
      })
      .from(videos)
      .where(and(eq(videos.id, videoId), isNull(videos.deletedAt)))
      .limit(1);

    if (!video) {
      throw new NotFoundException("Video not found");
    }

    const joined = await db
      .select({
        suggestion: suggestedShotEvents,
        shot: shotEvents,
      })
      .from(suggestedShotEvents)
      .leftJoin(shotEvents, eq(shotEvents.suggestedShotEventId, suggestedShotEvents.id))
      .where(eq(suggestedShotEvents.videoId, videoId))
      .orderBy(asc(suggestedShotEvents.timestampSeconds), asc(suggestedShotEvents.createdAt));

    const rows = joined.map(({ suggestion: s, shot }) => {
      const becameConfirmedShot = s.status === "accepted" || shot != null;
      return {
        suggestionId: s.id,
        suggestionTimestampSeconds: s.timestampSeconds,
        confidence: s.confidence,
        reason: s.reason ?? null,
        audioPeak: s.audioPeak ?? null,
        motionScore: s.motionScore ?? null,
        suggestionStatus: s.status,
        suggestionSource: s.source,
        becameConfirmedShot,
        confirmedShotEventId: shot?.id ?? null,
        confirmedShotType: shot?.shotType ?? null,
        confirmedSide: shot?.side ?? null,
        confirmedOutcome: shot?.outcome ?? null,
        pipelineVersion: s.debugMetadata?.pipelineVersion ?? s.source,
      };
    });

    return {
      schemaVersion: "1",
      exportedAt: new Date().toISOString(),
      video: {
        videoId: video.id,
        title: video.title,
        durationSeconds: video.durationSeconds,
        fps: video.fps,
        width: video.width,
        height: video.height,
        contentType: video.contentType ?? null,
        originalFilename: video.originalFilename ?? null,
        processingStatus: video.processingStatus,
        youtubeUrl: video.youtubeUrl ?? null,
        recordedAt: video.recordedAt ? toIso(video.recordedAt) : null,
      },
      rows,
    };
  }

  async statsForVideo(auth: AuthContext, videoId: string): Promise<SuggestedShotStatsDTO> {
    await this.assertVideoOwned(auth, videoId);
    const db = getDb();
    const rows = await db
      .select({
        status: suggestedShotEvents.status,
        confidence: suggestedShotEvents.confidence,
      })
      .from(suggestedShotEvents)
      .where(eq(suggestedShotEvents.videoId, videoId));

    const suggested = rows.filter((r) => r.status === "suggested");
    const accepted = rows.filter((r) => r.status === "accepted");
    const rejected = rows.filter((r) => r.status === "rejected");

    const avg = (list: typeof rows) =>
      list.length > 0
        ? Math.round((list.reduce((s, r) => s + r.confidence, 0) / list.length) * 1000) / 1000
        : null;

    return {
      suggested: suggested.length,
      accepted: accepted.length,
      rejected: rejected.length,
      avgConfidenceSuggested: avg(suggested),
      avgConfidenceAccepted: avg(accepted),
    };
  }

  async convertBatch(
    auth: AuthContext,
    videoId: string,
    body: ConvertSuggestedShotBatchBody,
  ): Promise<{ converted: ShotEventDTO[]; skipped: number }> {
    await this.assertVideoOwned(auth, videoId);
    const db = getDb();
    const pending = await db
      .select()
      .from(suggestedShotEvents)
      .where(
        and(
          eq(suggestedShotEvents.videoId, videoId),
          eq(suggestedShotEvents.status, "suggested"),
        ),
      )
      .orderBy(asc(suggestedShotEvents.timestampSeconds));

    const eligible = pending.filter((p) => p.confidence >= body.minConfidence);
    const skipped = pending.length - eligible.length;
    const converted: ShotEventDTO[] = [];

    for (const sug of eligible) {
      const result = await this.convertSuggestion(auth, videoId, sug.id, {});
      converted.push(result.shot);
    }

    return { converted, skipped };
  }

  /**
   * Re-downloads the stored upload and re-runs heuristic_v2 suggestions (synchronous MVP).
   * Pending heuristic rows (`heuristic_v1` / `heuristic_v2`) are replaced; accepted/rejected history is preserved.
   */
  async regenerateForVideo(
    auth: AuthContext,
    videoId: string,
  ): Promise<SuggestedShotRegenerateSummaryDTO> {
    await this.assertVideoOwned(auth, videoId);
    const env = loadEnv();
    if (!isS3Configured(env)) {
      throw new ServiceUnavailableException(
        "Object storage is not configured (required to download the video for regeneration).",
      );
    }

    const db = getDb();
    const [video] = await db
      .select({
        id: videos.id,
        youtubeUrl: videos.youtubeUrl,
        processingStatus: videos.processingStatus,
        storageBucket: videos.storageBucket,
        storageObjectKey: videos.storageObjectKey,
        durationSeconds: videos.durationSeconds,
      })
      .from(videos)
      .where(and(eq(videos.id, videoId), isNull(videos.deletedAt)))
      .limit(1);

    if (!video) {
      throw new NotFoundException("Video not found");
    }
    if (video.youtubeUrl) {
      throw new BadRequestException("Suggestions are not available for YouTube-only videos");
    }
    if (video.processingStatus !== "ready") {
      throw new BadRequestException("Video must be ready before regenerating suggestions");
    }
    if (!video.storageBucket || !video.storageObjectKey) {
      throw new BadRequestException("Video is missing storage object metadata");
    }

    const ext = path.extname(video.storageObjectKey);
    const suffix = ext && ext.length <= 8 ? ext : ".bin";
    const tmpRoot = await mkdtemp(path.join(tmpdir(), "pb-api-suggestions-"));
    const inputPath = path.join(tmpRoot, `source${suffix}`);

    try {
      const s3 = createS3ClientFromApiEnv(env);
      await downloadObjectToFile({
        client: s3,
        bucket: video.storageBucket,
        key: video.storageObjectKey,
        destPath: inputPath,
      });

      const pipelineResult = await runSuggestionPipeline({
        db,
        env: { FFMPEG_BIN: env.FFMPEG_BIN },
        videoId,
        inputPath,
        durationSeconds: video.durationSeconds,
      });

      const counts = await this.statsForVideo(auth, videoId);

      return {
        generatedCount: pipelineResult.inserted,
        averageConfidence: pipelineResult.stats.avgConfidence,
        pendingCount: counts.suggested,
        acceptedCount: counts.accepted,
        rejectedCount: counts.rejected,
      };
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  }

  async rejectSuggestion(auth: AuthContext, suggestionId: string): Promise<SuggestedShotEventDTO> {
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const [row] = await db
      .select({
        id: suggestedShotEvents.id,
        videoId: suggestedShotEvents.videoId,
        status: suggestedShotEvents.status,
        ownerId: videos.userId,
      })
      .from(suggestedShotEvents)
      .innerJoin(videos, eq(suggestedShotEvents.videoId, videos.id))
      .where(and(eq(suggestedShotEvents.id, suggestionId), isNull(videos.deletedAt)))
      .limit(1);
    if (!row) {
      throw new NotFoundException("Suggestion not found");
    }
    if (row.ownerId !== userId) {
      throw new ForbiddenException("You do not own this video");
    }
    if (row.status !== "suggested") {
      throw new ConflictException("Only pending suggestions can be rejected");
    }

    const [updated] = await db
      .update(suggestedShotEvents)
      .set({ status: "rejected", updatedAt: sql`now()` })
      .where(eq(suggestedShotEvents.id, suggestionId))
      .returning();
    if (!updated) {
      throw new NotFoundException("Suggestion not found");
    }
    return suggestedToDto(updated);
  }

  async convertSuggestion(
    auth: AuthContext,
    videoId: string,
    suggestionId: string,
    body: ConvertSuggestedShotBody,
  ): Promise<{ shot: ShotEventDTO; suggestion: SuggestedShotEventDTO }> {
    await this.assertVideoOwned(auth, videoId);
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();

    const [v] = await db
      .select({ youtubeUrl: videos.youtubeUrl })
      .from(videos)
      .where(and(eq(videos.id, videoId), isNull(videos.deletedAt)))
      .limit(1);
    if (v?.youtubeUrl) {
      throw new BadRequestException("Suggestions are not available for YouTube-only videos");
    }

    const [sug] = await db
      .select()
      .from(suggestedShotEvents)
      .where(and(eq(suggestedShotEvents.id, suggestionId), eq(suggestedShotEvents.videoId, videoId)))
      .limit(1);
    if (!sug) {
      throw new NotFoundException("Suggestion not found");
    }
    if (sug.status !== "suggested") {
      throw new ConflictException("This suggestion has already been used or dismissed");
    }

    const shotType = body.shotType ?? "unknown";
    const side = body.side ?? "unknown";
    const outcome = body.outcome ?? "unknown";
    const noteParts = [`From heuristic suggestion ${suggestionId}`];
    if (body.note?.trim()) noteParts.push(body.note.trim());
    const note = noteParts.join(" · ");

    return await db.transaction(async (tx) => {
      const [shotRow] = await tx
        .insert(shotEvents)
        .values({
          videoId,
          rallyId: null,
          timestampSeconds: sug.timestampSeconds,
          shotType,
          side,
          outcome,
          note,
          source: "manual",
          suggestedShotEventId: suggestionId,
          createdByUserId: userId,
        })
        .returning();

      if (!shotRow) {
        throw new BadRequestException("Could not create shot event");
      }

      const [sugUpdated] = await tx
        .update(suggestedShotEvents)
        .set({ status: "accepted", updatedAt: sql`now()` })
        .where(and(eq(suggestedShotEvents.id, suggestionId), eq(suggestedShotEvents.status, "suggested")))
        .returning();

      if (!sugUpdated) {
        throw new ConflictException("Suggestion was updated by another request");
      }

      return { shot: shotEventToDto(shotRow), suggestion: suggestedToDto(sugUpdated) };
    });
  }
}
