import type { ShotEventDTO } from "@pickleball/shared";
import type { CreateShotEventBody, UpdateShotEventBody } from "@pickleball/shared/zod";
import { and, asc, eq, getDb, isNull, sql } from "@pickleball/db";
import { shotEvents, videos } from "@pickleball/db/schema";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type { AuthContext } from "../../auth/auth.types.js";
import {
  applyEndsRallyToShot,
  assertRallyBelongsToVideo,
  nextShotIndexInRally,
  recomputeShotIndicesInRally,
} from "../rallies/rally-shot-helpers.js";
import { UsersService } from "../users/users.service.js";
import { shotEventToDto } from "./shot-event-mapper.js";

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
    return rows.map(shotEventToDto);
  }

  async createForVideo(
    auth: AuthContext,
    videoId: string,
    body: CreateShotEventBody,
  ): Promise<ShotEventDTO> {
    await this.assertVideoOwned(auth, videoId);
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();

    return db.transaction(async (tx) => {
      const rallyId = body.rallyId ?? null;
      let shotIndexInRally: number | null = null;
      let endsRally = body.endsRally ?? false;

      if (rallyId) {
        const rally = await assertRallyBelongsToVideo(tx, rallyId, videoId);
        if (rally.endTimeSeconds != null && !endsRally) {
          throw new BadRequestException("Rally is already closed; mark endsRally or open a new rally");
        }
        shotIndexInRally = await nextShotIndexInRally(tx, rallyId);
      } else {
        endsRally = false;
      }

      const [row] = await tx
        .insert(shotEvents)
        .values({
          videoId,
          rallyId,
          playerSlot: body.playerSlot ?? null,
          shotIndexInRally,
          endsRally,
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

      if (rallyId && endsRally) {
        const rally = await assertRallyBelongsToVideo(tx, rallyId, videoId);
        await applyEndsRallyToShot(tx, rally, row);
      } else if (rallyId) {
        await recomputeShotIndicesInRally(tx, rallyId);
      }

      const [final] = await tx.select().from(shotEvents).where(eq(shotEvents.id, row.id)).limit(1);
      return shotEventToDto(final ?? row);
    });
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
        shot: shotEvents,
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

    const prev = existing.shot;
    const videoId = prev.videoId;
    const newRallyId = body.rallyId !== undefined ? body.rallyId : prev.rallyId;
    const newEndsRally = body.endsRally !== undefined ? body.endsRally : prev.endsRally;

    return db.transaction(async (tx) => {
      if (newRallyId) {
        await assertRallyBelongsToVideo(tx, newRallyId, videoId);
      }

      const [updated] = await tx
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
          ...(body.playerSlot !== undefined ? { playerSlot: body.playerSlot } : {}),
          ...(body.endsRally !== undefined ? { endsRally: body.endsRally } : {}),
          updatedAt: sql`now()`,
        })
        .where(eq(shotEvents.id, eventId))
        .returning();
      if (!updated) {
        throw new NotFoundException("Shot event not found");
      }

      const rallyId = updated.rallyId;
      if (prev.rallyId && prev.rallyId !== rallyId) {
        await recomputeShotIndicesInRally(tx, prev.rallyId);
      }

      if (rallyId) {
        await recomputeShotIndicesInRally(tx, rallyId);
        const [fresh] = await tx.select().from(shotEvents).where(eq(shotEvents.id, eventId)).limit(1);
        const shotRow = fresh ?? updated;
        if (newEndsRally) {
          const rally = await assertRallyBelongsToVideo(tx, rallyId, videoId);
          await applyEndsRallyToShot(tx, rally, shotRow);
        }
        const [final] = await tx.select().from(shotEvents).where(eq(shotEvents.id, eventId)).limit(1);
        return shotEventToDto(final ?? shotRow);
      }

      if (prev.endsRally && prev.rallyId) {
        await tx
          .update(shotEvents)
          .set({ endsRally: false, updatedAt: sql`now()` })
          .where(eq(shotEvents.id, eventId));
      }

      return shotEventToDto(updated);
    });
  }

  async deleteEvent(auth: AuthContext, eventId: string): Promise<void> {
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const [existing] = await db
      .select({
        id: shotEvents.id,
        rallyId: shotEvents.rallyId,
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

    const rallyId = existing.rallyId;
    await db.delete(shotEvents).where(eq(shotEvents.id, eventId));
    if (rallyId) {
      await recomputeShotIndicesInRally(db, rallyId);
    }
  }
}
