import type { VideoSideSwitchDTO } from "@pickleball/shared";
import type { VideoSideSwitchRow } from "@pickleball/db/schema";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function sideSwitchToDto(row: VideoSideSwitchRow): VideoSideSwitchDTO {
  return {
    id: row.id,
    videoId: row.videoId,
    timestampSeconds: row.timestampSeconds,
    note: row.note,
    segmentIndex: row.segmentIndex,
    createdAt: toIso(row.createdAt),
  };
}
