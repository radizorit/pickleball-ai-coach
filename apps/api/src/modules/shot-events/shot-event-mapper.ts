import type { ShotEventDTO } from "@pickleball/shared";
import type { ShotEventRow } from "@pickleball/db/schema";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function shotEventToDto(row: ShotEventRow): ShotEventDTO {
  return {
    id: row.id,
    videoId: row.videoId,
    rallyId: row.rallyId ?? null,
    playerSlot: row.playerSlot ?? null,
    shotIndexInRally: row.shotIndexInRally ?? null,
    endsRally: row.endsRally,
    timestampSeconds: row.timestampSeconds,
    shotType: row.shotType,
    side: row.side,
    outcome: row.outcome,
    note: row.note ?? null,
    source: row.source,
    suggestedShotEventId: row.suggestedShotEventId ?? null,
    createdByUserId: row.createdByUserId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}
