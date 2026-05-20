import type {
  RallyConsistencyStatsDTO,
  SuggestedRallyDTO,
  VideoPlayerDTO,
  VideoRallyDTO,
} from "@pickleball/shared";
import { computeRallyConsistencyStats, DEFAULT_VIDEO_PLAYER_SLOTS } from "@pickleball/shared";
import type { CreateRallyBody, UpdateRallyBody, UpsertVideoPlayersBody } from "@pickleball/shared/zod";
import { and, asc, eq, getDb, isNull, sql } from "@pickleball/db";
import { rallies, shotEvents, suggestedRallies, videoPlayers, videos } from "@pickleball/db/schema";
import type { SuggestedRallyRow } from "@pickleball/db/schema";
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
import { shotEventToDto } from "../shot-events/shot-event-mapper.js";
import { videoPlayerToDto, videoRallyToDto } from "./rallies.mapper.js";

function suggestedRallyToDto(row: SuggestedRallyRow): SuggestedRallyDTO {
  const toIso = (value: Date | string) =>
    value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  return {
    id: row.id,
    videoId: row.videoId,
    proposalIndex: row.proposalIndex,
    startTimeSeconds: row.startTimeSeconds,
    endTimeSeconds: row.endTimeSeconds,
    confidence: row.confidence,
    status: row.status,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

@Injectable()
export class RalliesService {
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

  async listPlayers(auth: AuthContext, videoId: string): Promise<VideoPlayerDTO[]> {
    await this.assertVideoOwned(auth, videoId);
    const db = getDb();
    await this.ensureDefaultPlayers(db, videoId);
    await this.backfillSoloDisplayNames(db, videoId);
    const rows = await db
      .select()
      .from(videoPlayers)
      .where(eq(videoPlayers.videoId, videoId))
      .orderBy(asc(videoPlayers.slot));
    return rows.map(videoPlayerToDto);
  }

  async upsertPlayers(
    auth: AuthContext,
    videoId: string,
    body: UpsertVideoPlayersBody,
  ): Promise<VideoPlayerDTO[]> {
    await this.assertVideoOwned(auth, videoId);
    const db = getDb();
    await this.ensureDefaultPlayers(db, videoId);

    for (const p of body.players) {
      await db
        .update(videoPlayers)
        .set({
          displayName: p.displayName?.trim() ? p.displayName.trim() : null,
          updatedAt: sql`now()`,
        })
        .where(and(eq(videoPlayers.videoId, videoId), eq(videoPlayers.slot, p.slot)));
    }

    return this.listPlayers(auth, videoId);
  }

  private soloDefaultName(slot: (typeof DEFAULT_VIDEO_PLAYER_SLOTS)[number]): string | null {
    if (slot === "player_1") return "Me";
    return null;
  }

  private async ensureDefaultPlayers(db: ReturnType<typeof getDb>, videoId: string): Promise<void> {
    const existing = await db
      .select({ slot: videoPlayers.slot })
      .from(videoPlayers)
      .where(eq(videoPlayers.videoId, videoId));
    const have = new Set(existing.map((r) => r.slot));
    for (const slot of DEFAULT_VIDEO_PLAYER_SLOTS) {
      if (!have.has(slot)) {
        await db.insert(videoPlayers).values({
          videoId,
          slot,
          displayName: this.soloDefaultName(slot),
        });
      }
    }
  }

  /** One-time fill: default display name for Me (player_1) only. */
  private async backfillSoloDisplayNames(
    db: ReturnType<typeof getDb>,
    videoId: string,
  ): Promise<void> {
    const [row] = await db
      .select()
      .from(videoPlayers)
      .where(and(eq(videoPlayers.videoId, videoId), eq(videoPlayers.slot, "player_1")))
      .limit(1);
    if (!row || row.displayName?.trim()) return;
    await db
      .update(videoPlayers)
      .set({ displayName: "Me", updatedAt: sql`now()` })
      .where(and(eq(videoPlayers.videoId, videoId), eq(videoPlayers.slot, "player_1")));
  }

  async listRallies(auth: AuthContext, videoId: string): Promise<VideoRallyDTO[]> {
    await this.assertVideoOwned(auth, videoId);
    const db = getDb();
    const rallyRows = await db
      .select()
      .from(rallies)
      .where(eq(rallies.videoId, videoId))
      .orderBy(asc(rallies.startTimeSeconds));

    const shotRows = await db
      .select({ rallyId: shotEvents.rallyId })
      .from(shotEvents)
      .where(eq(shotEvents.videoId, videoId));

    const counts = new Map<string, number>();
    for (const s of shotRows) {
      if (!s.rallyId) continue;
      counts.set(s.rallyId, (counts.get(s.rallyId) ?? 0) + 1);
    }

    return rallyRows.map((r) => videoRallyToDto(r, counts.get(r.id) ?? 0));
  }

  async createRally(
    auth: AuthContext,
    videoId: string,
    body: CreateRallyBody,
  ): Promise<VideoRallyDTO> {
    await this.assertVideoOwned(auth, videoId);
    if (
      body.endTimeSeconds != null &&
      body.endTimeSeconds < body.startTimeSeconds
    ) {
      throw new BadRequestException("endTimeSeconds must be >= startTimeSeconds");
    }

    const db = getDb();
    const [row] = await db
      .insert(rallies)
      .values({
        videoId,
        startTimeSeconds: body.startTimeSeconds,
        endTimeSeconds: body.endTimeSeconds ?? null,
      })
      .returning();
    if (!row) {
      throw new BadRequestException("Could not create rally");
    }
    return videoRallyToDto(row, 0);
  }

  async updateRally(auth: AuthContext, rallyId: string, body: UpdateRallyBody): Promise<VideoRallyDTO> {
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const [existing] = await db
      .select({
        rally: rallies,
        ownerId: videos.userId,
      })
      .from(rallies)
      .innerJoin(videos, eq(rallies.videoId, videos.id))
      .where(and(eq(rallies.id, rallyId), isNull(videos.deletedAt)))
      .limit(1);
    if (!existing) {
      throw new NotFoundException("Rally not found");
    }
    if (existing.ownerId !== userId) {
      throw new ForbiddenException("You do not own this video");
    }

    const start =
      body.startTimeSeconds !== undefined
        ? body.startTimeSeconds
        : existing.rally.startTimeSeconds;
    const end =
      body.endTimeSeconds !== undefined
        ? body.endTimeSeconds
        : existing.rally.endTimeSeconds;
    if (end != null && end < start) {
      throw new BadRequestException("endTimeSeconds must be >= startTimeSeconds");
    }

    const [updated] = await db
      .update(rallies)
      .set({
        ...(body.startTimeSeconds !== undefined
          ? { startTimeSeconds: body.startTimeSeconds }
          : {}),
        ...(body.endTimeSeconds !== undefined ? { endTimeSeconds: body.endTimeSeconds } : {}),
        ...(body.winningPlayerSlot !== undefined
          ? { winningPlayerSlot: body.winningPlayerSlot }
          : {}),
        ...(body.endReason !== undefined ? { endReason: body.endReason } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(rallies.id, rallyId))
      .returning();
    if (!updated) {
      throw new NotFoundException("Rally not found");
    }

    const shotCountRows = await db
      .select({ id: shotEvents.id })
      .from(shotEvents)
      .where(eq(shotEvents.rallyId, rallyId));

    return videoRallyToDto(updated, shotCountRows.length);
  }

  async deleteRally(auth: AuthContext, rallyId: string): Promise<void> {
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const [existing] = await db
      .select({ ownerId: videos.userId })
      .from(rallies)
      .innerJoin(videos, eq(rallies.videoId, videos.id))
      .where(and(eq(rallies.id, rallyId), isNull(videos.deletedAt)))
      .limit(1);
    if (!existing) {
      throw new NotFoundException("Rally not found");
    }
    if (existing.ownerId !== userId) {
      throw new ForbiddenException("You do not own this video");
    }

    await db.transaction(async (tx) => {
      await tx
        .update(shotEvents)
        .set({ rallyId: null, shotIndexInRally: null, endsRally: false, updatedAt: sql`now()` })
        .where(eq(shotEvents.rallyId, rallyId));
      await tx.delete(rallies).where(eq(rallies.id, rallyId));
    });
  }

  async listSuggestedRallies(auth: AuthContext, videoId: string): Promise<SuggestedRallyDTO[]> {
    await this.assertVideoOwned(auth, videoId);
    const db = getDb();
    const rows = await db
      .select()
      .from(suggestedRallies)
      .where(eq(suggestedRallies.videoId, videoId))
      .orderBy(asc(suggestedRallies.startTimeSeconds), asc(suggestedRallies.proposalIndex));
    return rows.map(suggestedRallyToDto);
  }

  async acceptSuggestedRally(
    auth: AuthContext,
    videoId: string,
    suggestedRallyId: string,
  ): Promise<{ rally: VideoRallyDTO; suggestion: SuggestedRallyDTO }> {
    await this.assertVideoOwned(auth, videoId);
    const db = getDb();
    const [proposal] = await db
      .select()
      .from(suggestedRallies)
      .where(
        and(eq(suggestedRallies.id, suggestedRallyId), eq(suggestedRallies.videoId, videoId)),
      )
      .limit(1);
    if (!proposal) {
      throw new NotFoundException("Suggested rally not found");
    }
    if (proposal.status !== "suggested") {
      throw new BadRequestException("This rally proposal has already been used or dismissed");
    }

    return db.transaction(async (tx) => {
      const [rallyRow] = await tx
        .insert(rallies)
        .values({
          videoId,
          startTimeSeconds: proposal.startTimeSeconds,
          endTimeSeconds: proposal.endTimeSeconds,
        })
        .returning();
      if (!rallyRow) {
        throw new BadRequestException("Could not create rally");
      }

      const [sugUpdated] = await tx
        .update(suggestedRallies)
        .set({ status: "accepted", updatedAt: sql`now()` })
        .where(
          and(
            eq(suggestedRallies.id, suggestedRallyId),
            eq(suggestedRallies.status, "suggested"),
          ),
        )
        .returning();
      if (!sugUpdated) {
        throw new ConflictException("Rally proposal was updated by another request");
      }

      return {
        rally: videoRallyToDto(rallyRow, 0),
        suggestion: suggestedRallyToDto(sugUpdated),
      };
    });
  }

  async rejectSuggestedRally(
    auth: AuthContext,
    videoId: string,
    suggestedRallyId: string,
  ): Promise<SuggestedRallyDTO> {
    await this.assertVideoOwned(auth, videoId);
    const db = getDb();
    const [proposal] = await db
      .select()
      .from(suggestedRallies)
      .where(
        and(eq(suggestedRallies.id, suggestedRallyId), eq(suggestedRallies.videoId, videoId)),
      )
      .limit(1);
    if (!proposal) {
      throw new NotFoundException("Suggested rally not found");
    }
    if (proposal.status !== "suggested") {
      throw new BadRequestException("Only pending rally proposals can be rejected");
    }

    const [updated] = await db
      .update(suggestedRallies)
      .set({ status: "rejected", updatedAt: sql`now()` })
      .where(eq(suggestedRallies.id, suggestedRallyId))
      .returning();
    if (!updated) {
      throw new NotFoundException("Suggested rally not found");
    }
    return suggestedRallyToDto(updated);
  }

  async consistencyForVideo(
    auth: AuthContext,
    videoId: string,
  ): Promise<RallyConsistencyStatsDTO> {
    await this.assertVideoOwned(auth, videoId);
    const db = getDb();
    const rallyDtos = await this.listRallies(auth, videoId);
    const shotRows = await db
      .select()
      .from(shotEvents)
      .where(eq(shotEvents.videoId, videoId))
      .orderBy(asc(shotEvents.timestampSeconds), asc(shotEvents.createdAt));
    const players = await this.listPlayers(auth, videoId);
    return computeRallyConsistencyStats({
      rallies: rallyDtos,
      shots: shotRows.map(shotEventToDto),
      players,
    });
  }
}
