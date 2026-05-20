import type { VideoSideSwitchDTO } from "@pickleball/shared";
import type { CreateVideoSideSwitchBody } from "@pickleball/shared/zod";
import { and, asc, eq, getDb, isNull } from "@pickleball/db";
import { videoSideSwitches, videos } from "@pickleball/db/schema";
import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthContext } from "../../auth/auth.types.js";
import { UsersService } from "../users/users.service.js";
import { sideSwitchToDto } from "./side-switch.mapper.js";

@Injectable()
export class SideSwitchesService {
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

  async listForVideo(auth: AuthContext, videoId: string): Promise<VideoSideSwitchDTO[]> {
    await this.assertVideoOwned(auth, videoId);
    const db = getDb();
    const rows = await db
      .select()
      .from(videoSideSwitches)
      .where(eq(videoSideSwitches.videoId, videoId))
      .orderBy(asc(videoSideSwitches.timestampSeconds), asc(videoSideSwitches.createdAt));
    return rows.map(sideSwitchToDto);
  }

  async createForVideo(
    auth: AuthContext,
    videoId: string,
    body: CreateVideoSideSwitchBody,
  ): Promise<VideoSideSwitchDTO> {
    await this.assertVideoOwned(auth, videoId);
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();

    const prior = await db
      .select({ id: videoSideSwitches.id })
      .from(videoSideSwitches)
      .where(eq(videoSideSwitches.videoId, videoId));

    const segmentIndex = prior.length;

    const [row] = await db
      .insert(videoSideSwitches)
      .values({
        videoId,
        timestampSeconds: body.timestampSeconds,
        note: body.note?.trim() ? body.note.trim() : null,
        segmentIndex,
        createdByUserId: userId,
      })
      .returning();

    if (!row) {
      throw new NotFoundException("Failed to create side switch");
    }
    return sideSwitchToDto(row);
  }

  async deleteById(auth: AuthContext, id: string): Promise<{ ok: true }> {
    const userId = await this.users.resolveDbUserId(auth);
    const db = getDb();
    const [existing] = await db
      .select({ id: videoSideSwitches.id, videoId: videoSideSwitches.videoId })
      .from(videoSideSwitches)
      .where(eq(videoSideSwitches.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Side switch not found");
    }

    const [video] = await db
      .select({ userId: videos.userId })
      .from(videos)
      .where(and(eq(videos.id, existing.videoId), isNull(videos.deletedAt)))
      .limit(1);

    if (!video || video.userId !== userId) {
      throw new ForbiddenException("Not allowed to delete this side switch");
    }

    await db.delete(videoSideSwitches).where(eq(videoSideSwitches.id, id));
    return { ok: true };
  }
}
