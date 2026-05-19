import type { ShotEventDTO } from "@pickleball/shared";
import type { CreateShotEventBody, UpdateShotEventBody } from "@pickleball/shared/zod";
import { and, asc, eq, getDb, isNull, sql } from "@pickleball/db";
import { shotEvents, videos } from "@pickleball/db/schema";
import type { ShotEventRow } from "@pickleball/db/schema";
import {
  BadRequestException,
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

function toDto(row: ShotEventRow): ShotEventDTO {
  return {
    id: row.id,
    videoId: row.videoId,
    rallyId: row.rallyId ?? null,
    timestampSeconds: row.timestampSeconds,
    shotType: row.shotType,
    side: row.side,
    outcome: row.outcome,
    note: row.note ?? null,
    source: row.source,
    createdByUserId: row.createdByUserId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

@Injectable()
export class ShotEventsService {
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

  async listForVideo(auth: AuthContext, videoId: string): Promise<ShotEventDTO[]> {
    await this.assertVideoOwned(auth, videoId);
    const db = getDb();
    const rows = await db
      .select()
      .from(shotEvents)
      .where(eq(shotEvents.videoId, videoId))
      .orderBy(asc(shotEvents.timestampSeconds), asc(shotEvents.createdAt));
    return rows.map(toDto);
  }

  async createForVideo(
    auth: AuthContext,
    videoId: string,
    body: CreateShotEventBody,
  ): Promise<ShotEventDTO> {
    await this.assertVideoOwned(auth, videoId);
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const [row] = await db
      .insert(shotEvents)
      .values({
        videoId,
        rallyId: body.rallyId ?? null,
        timestampSeconds: body.timestampSeconds,
        shotType: body.shotType,
        side: body.side,
        outcome: body.outcome,
        note: body.note?.trim() ? body.note.trim() : null,
        source: "manual",
        createdByUserId: userId,
      })
      .returning();
    if (!row) {
      throw new BadRequestException("Could not create shot event");
    }
    return toDto(row);
  }

  async updateEvent(
    auth: AuthContext,
    eventId: string,
    body: UpdateShotEventBody,
  ): Promise<ShotEventDTO> {
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const [existing] = await db
      .select({
        id: shotEvents.id,
        videoId: shotEvents.videoId,
        ownerId: videos.userId,
      })
      .from(shotEvents)
      .innerJoin(videos, eq(shotEvents.videoId, videos.id))
      .where(and(eq(shotEvents.id, eventId), isNull(videos.deletedAt)))
      .limit(1);
    if (!existing) {
      throw new NotFoundException("Shot event not found");
    }
    if (existing.ownerId !== userId) {
      throw new ForbiddenException("You do not own this video");
    }

    const [updated] = await db
      .update(shotEvents)
      .set({
        ...(body.timestampSeconds !== undefined
          ? { timestampSeconds: body.timestampSeconds }
          : {}),
        ...(body.shotType !== undefined ? { shotType: body.shotType } : {}),
        ...(body.side !== undefined ? { side: body.side } : {}),
        ...(body.outcome !== undefined ? { outcome: body.outcome } : {}),
        ...(body.note !== undefined
          ? { note: body.note?.trim() ? body.note.trim() : null }
          : {}),
        ...(body.rallyId !== undefined ? { rallyId: body.rallyId } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(shotEvents.id, eventId))
      .returning();
    if (!updated) {
      throw new NotFoundException("Shot event not found");
    }
    return toDto(updated);
  }

  async deleteEvent(auth: AuthContext, eventId: string): Promise<void> {
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const [existing] = await db
      .select({
        id: shotEvents.id,
        ownerId: videos.userId,
      })
      .from(shotEvents)
      .innerJoin(videos, eq(shotEvents.videoId, videos.id))
      .where(and(eq(shotEvents.id, eventId), isNull(videos.deletedAt)))
      .limit(1);
    if (!existing) {
      throw new NotFoundException("Shot event not found");
    }
    if (existing.ownerId !== userId) {
      throw new ForbiddenException("You do not own this video");
    }
    await db.delete(shotEvents).where(eq(shotEvents.id, eventId));
  }
}
