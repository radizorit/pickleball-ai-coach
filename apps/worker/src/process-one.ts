import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { S3Client } from "@aws-sdk/client-s3";
import { and, eq, getDb, sql } from "@pickleball/db";
import { videos } from "@pickleball/db/schema";
import type { Video } from "@pickleball/db/schema";

import { claimNextVideo } from "./claim.js";
import type { WorkerEnv } from "./env.js";
import { downloadObjectToFile, uploadJpegFile } from "./s3-client.js";
import { runHeuristicSuggestedShots } from "./heuristic-suggested-shots.js";
import { ffmpegThumbnailJpeg, ffprobeVideoMeta } from "./media.js";

const FAILURE_MAX_LEN = 4000;

function truncateFailureMessage(message: string): string {
  if (message.length <= FAILURE_MAX_LEN) return message;
  return `${message.slice(0, FAILURE_MAX_LEN - 20)}…(truncated)`;
}

function posterObjectKey(video: Video): string {
  return `videos/${video.userId}/${video.id}/poster.jpg`;
}

function seekSeconds(durationSeconds: number | null): number {
  if (durationSeconds == null || durationSeconds <= 0) return 0;
  return Math.min(1, Math.max(0.1, durationSeconds / 2));
}

function extensionFromObjectKey(objectKey: string): string {
  const ext = path.extname(objectKey);
  return ext && ext.length <= 8 ? ext : ".bin";
}

export async function markVideoFailed(videoId: string, err: unknown): Promise<void> {
  const db = getDb();
  const message = truncateFailureMessage(err instanceof Error ? err.message : String(err));
  await db
    .update(videos)
    .set({
      processingStatus: "failed",
      failureMessage: message,
      updatedAt: sql`now()`,
    })
    .where(and(eq(videos.id, videoId), eq(videos.processingStatus, "processing")));
}

export async function processVideoJob(params: {
  env: WorkerEnv;
  s3: S3Client;
  video: Video;
}): Promise<void> {
  const { env, s3, video } = params;
  const bucket = video.storageBucket;
  const sourceKey = video.storageObjectKey;
  if (!bucket || !sourceKey) {
    throw new Error("Video is missing storage bucket or object key");
  }

  const tmpRoot = await mkdtemp(path.join(tmpdir(), "pb-worker-"));
  const inputPath = path.join(tmpRoot, `input${extensionFromObjectKey(sourceKey)}`);
  const posterPath = path.join(tmpRoot, "poster.jpg");

  try {
    await downloadObjectToFile({ client: s3, bucket, key: sourceKey, destPath: inputPath });

    const meta = await ffprobeVideoMeta(env, inputPath);

    try {
      const n = await runHeuristicSuggestedShots({
        db: getDb(),
        env,
        videoId: video.id,
        inputPath,
        durationSeconds: meta.durationSeconds,
      });
      if (n > 0) {
        console.info(`[worker] heuristic suggestions: ${n} candidates for video ${video.id}`);
      }
    } catch (err) {
      console.error(`[worker] heuristic suggestions skipped for ${video.id}:`, err);
    }

    await ffmpegThumbnailJpeg({
      env,
      inputPath,
      outputPath: posterPath,
      seekSeconds: seekSeconds(meta.durationSeconds),
    });

    const thumbKey = posterObjectKey(video);
    await uploadJpegFile({ client: s3, bucket, key: thumbKey, filePath: posterPath });

    const db = getDb();
    const [updated] = await db
      .update(videos)
      .set({
        processingStatus: "ready",
        durationSeconds: meta.durationSeconds,
        fps: meta.fps,
        width: meta.width,
        height: meta.height,
        thumbnailObjectKey: thumbKey,
        failureMessage: null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(videos.id, video.id), eq(videos.processingStatus, "processing")))
      .returning({ id: videos.id });

    if (!updated) {
      // Another worker finished or status changed; avoid overwriting.
      return;
    }
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

export async function claimAndProcessOne(params: {
  env: WorkerEnv;
  s3: S3Client;
}): Promise<boolean> {
  const db = getDb();
  const video = await claimNextVideo(db, params.env.WORKER_STALE_PROCESSING_SECONDS);
  if (!video) {
    return false;
  }

  try {
    await processVideoJob({ env: params.env, s3: params.s3, video });
  } catch (err) {
    await markVideoFailed(video.id, err);
  }
  return true;
}
