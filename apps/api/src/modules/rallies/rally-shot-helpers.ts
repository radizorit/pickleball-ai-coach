import type { ShotOutcome, VideoPlayerSlot } from "@pickleball/shared/constants";
import { deriveRallyEndFromShot } from "@pickleball/shared";
import { and, asc, eq, ne, sql } from "@pickleball/db";
import type { DB } from "@pickleball/db";
import { rallies, shotEvents } from "@pickleball/db/schema";
import type { RallyRow, ShotEventRow } from "@pickleball/db/schema";
import { BadRequestException } from "@nestjs/common";

export async function assertRallyBelongsToVideo(
  db: DB,
  rallyId: string,
  videoId: string,
): Promise<RallyRow> {
  const [row] = await db.select().from(rallies).where(eq(rallies.id, rallyId)).limit(1);
  if (!row || row.videoId !== videoId) {
    throw new BadRequestException("Rally does not belong to this video");
  }
  return row;
}

export async function nextShotIndexInRally(db: DB, rallyId: string): Promise<number> {
  const rows = await db
    .select({ shotIndexInRally: shotEvents.shotIndexInRally })
    .from(shotEvents)
    .where(eq(shotEvents.rallyId, rallyId));
  const max = rows.reduce((m, r) => Math.max(m, r.shotIndexInRally ?? 0), 0);
  return max + 1;
}

/** Re-number `shot_index_in_rally` by timestamp order within a rally. */
export async function recomputeShotIndicesInRally(
  db: DB,
  rallyId: string,
): Promise<void> {
  const rows = await db
    .select()
    .from(shotEvents)
    .where(eq(shotEvents.rallyId, rallyId))
    .orderBy(asc(shotEvents.timestampSeconds), asc(shotEvents.createdAt));

  for (let i = 0; i < rows.length; i++) {
    const idx = i + 1;
    const row = rows[i]!;
    if (row.shotIndexInRally !== idx) {
      await db
        .update(shotEvents)
        .set({ shotIndexInRally: idx, updatedAt: sql`now()` })
        .where(eq(shotEvents.id, row.id));
    }
  }
}

export async function clearEndsRallyFlags(
  db: DB,
  rallyId: string,
  exceptEventId?: string,
): Promise<void> {
  const condition = exceptEventId
    ? and(eq(shotEvents.rallyId, rallyId), ne(shotEvents.id, exceptEventId))
    : eq(shotEvents.rallyId, rallyId);
  await db
    .update(shotEvents)
    .set({ endsRally: false, updatedAt: sql`now()` })
    .where(condition);
}

export async function applyEndsRallyToShot(
  db: DB,
  rally: RallyRow,
  shot: Pick<ShotEventRow, "id" | "timestampSeconds" | "outcome" | "playerSlot">,
): Promise<void> {
  if (shot.timestampSeconds < rally.startTimeSeconds) {
    throw new BadRequestException("Shot timestamp is before rally start");
  }

  await clearEndsRallyFlags(db, rally.id, shot.id);

  const { endReason, winningPlayerSlot } = deriveRallyEndFromShot({
    outcome: shot.outcome as ShotOutcome,
    playerSlot: shot.playerSlot as VideoPlayerSlot | null,
  });

  await db
    .update(rallies)
    .set({
      endTimeSeconds: shot.timestampSeconds,
      endReason,
      winningPlayerSlot,
      updatedAt: sql`now()`,
    })
    .where(eq(rallies.id, rally.id));

  await db
    .update(shotEvents)
    .set({ endsRally: true, updatedAt: sql`now()` })
    .where(eq(shotEvents.id, shot.id));
}

/** Reopen a rally after the ending shot is cleared or removed. */
export async function reopenRally(db: DB, rallyId: string): Promise<void> {
  await db
    .update(rallies)
    .set({
      endTimeSeconds: null,
      endReason: null,
      winningPlayerSlot: null,
      updatedAt: sql`now()`,
    })
    .where(eq(rallies.id, rallyId));
}

/** If no shot still ends the rally, clear rally end metadata. */
export async function syncRallyEndFromShots(db: DB, rallyId: string): Promise<void> {
  const [ending] = await db
    .select({ id: shotEvents.id })
    .from(shotEvents)
    .where(and(eq(shotEvents.rallyId, rallyId), eq(shotEvents.endsRally, true)))
    .limit(1);
  if (!ending) {
    await reopenRally(db, rallyId);
  }
}
