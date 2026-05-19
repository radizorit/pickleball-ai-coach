import type { ShotEventDTO, SuggestedShotEventDTO } from "@pickleball/shared";
import type { ConvertSuggestedShotBody } from "@pickleball/shared/zod";
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
} from "@nestjs/common";

import type { AuthContext } from "../../auth/auth.types.js";
import { UsersService } from "../users/users.service.js";

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

      const shot: ShotEventDTO = {
        id: shotRow.id,
        videoId: shotRow.videoId,
        rallyId: shotRow.rallyId ?? null,
        timestampSeconds: shotRow.timestampSeconds,
        shotType: shotRow.shotType,
        side: shotRow.side,
        outcome: shotRow.outcome,
        note: shotRow.note ?? null,
        source: shotRow.source,
        createdByUserId: shotRow.createdByUserId,
        createdAt: toIso(shotRow.createdAt),
        updatedAt: toIso(shotRow.updatedAt),
      };

      return { shot, suggestion: suggestedToDto(sugUpdated) };
    });
  }
}
