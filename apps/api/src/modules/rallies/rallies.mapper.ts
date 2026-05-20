import type { VideoPlayerDTO, VideoRallyDTO } from "@pickleball/shared";
import type { RallyRow, VideoPlayerRow } from "@pickleball/db/schema";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function videoPlayerToDto(row: VideoPlayerRow): VideoPlayerDTO {
  return {
    videoId: row.videoId,
    slot: row.slot,
    displayName: row.displayName ?? null,
  };
}

export function videoRallyToDto(row: RallyRow, shotCount: number): VideoRallyDTO {
  return {
    id: row.id,
    videoId: row.videoId,
    startTimeSeconds: row.startTimeSeconds,
    endTimeSeconds: row.endTimeSeconds ?? null,
    winningPlayerSlot: row.winningPlayerSlot ?? null,
    endReason: row.endReason ?? null,
    shotCount,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}
