import type { DB } from "@pickleball/db";
import { and, asc, eq, isNotNull, isNull, lt, or, sql } from "@pickleball/db";
import { videos } from "@pickleball/db/schema";
import type { Video } from "@pickleball/db/schema";

/**
 * Atomically pick the next video to process:
 * - `uploaded` rows (post browser PUT + API complete-upload)
 * - stale `processing` rows (worker crash / long ffprobe)
 *
 * Uses `FOR UPDATE SKIP LOCKED` so multiple worker processes can run safely.
 * A later queue (SQS, BullMQ, etc.) can call the same processor with an explicit id.
 */
export async function claimNextVideo(db: DB, staleSeconds: number): Promise<Video | null> {
  return db.transaction(async (tx) => {
    const staleBefore = sql`now() - (${staleSeconds} * interval '1 second')`;

    const [picked] = await tx
      .select()
      .from(videos)
      .where(
        and(
          isNull(videos.deletedAt),
          isNotNull(videos.storageObjectKey),
          isNotNull(videos.storageBucket),
          or(
            eq(videos.processingStatus, "uploaded"),
            and(eq(videos.processingStatus, "processing"), lt(videos.updatedAt, staleBefore)),
          ),
        ),
      )
      .orderBy(asc(videos.updatedAt))
      .limit(1)
      .for("update", { skipLocked: true });

    if (!picked) {
      return null;
    }

    const [updated] = await tx
      .update(videos)
      .set({
        processingStatus: "processing",
        failureMessage: null,
        updatedAt: sql`now()`,
      })
      .where(eq(videos.id, picked.id))
      .returning();

    return updated ?? null;
  });
}
