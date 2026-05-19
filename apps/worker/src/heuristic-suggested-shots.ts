import { spawn } from "node:child_process";

import { and, eq } from "@pickleball/db";
import { suggestedShotEvents } from "@pickleball/db/schema";
import type { DB } from "@pickleball/db";

import type { WorkerEnv } from "./env.js";

const SCENE_THRESHOLD = 0.3;
const MERGE_GAP_SEC = 0.35;
const MAX_SUGGESTIONS = 40;

function runFfmpegSceneDetect(ffmpegBin: string, inputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegBin,
      [
        "-hide_banner",
        "-nostats",
        "-i",
        inputPath,
        "-filter:v",
        `select='gt(scene,${SCENE_THRESHOLD})',showinfo`,
        "-f",
        "null",
        "-",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    child.stdout.on("data", (d) => {
      out += String(d);
    });
    child.stderr.on("data", (d) => {
      out += String(d);
    });
    child.on("error", reject);
    child.on("close", () => {
      resolve(out);
    });
  });
}

/** Parse `pts_time:12.345` lines from ffmpeg showinfo output. */
export function parsePtsTimesFromShowinfo(log: string): number[] {
  const re = /pts_time:\s*([\d.]+)/g;
  const times: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(log)) !== null) {
    const t = Number(m[1]);
    if (Number.isFinite(t) && t >= 0) times.push(t);
  }
  return times;
}

/** Merge hits within MERGE_GAP_SEC (cluster midpoint). */
export function mergeNearbyTimes(times: number[]): number[] {
  const sorted = [...times].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const clusters: number[][] = [];
  let cur: number[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const t = sorted[i]!;
    if (t - cur[cur.length - 1]! <= MERGE_GAP_SEC) {
      cur.push(t);
    } else {
      clusters.push(cur);
      cur = [t];
    }
  }
  clusters.push(cur);
  return clusters.map((c) => c.reduce((a, b) => a + b, 0) / c.length);
}

function confidenceForIndex(i: number, n: number): number {
  if (n <= 1) return 0.72;
  const rank = i / (n - 1);
  return Math.round((0.55 + 0.4 * (1 - rank)) * 100) / 100;
}

/**
 * Deletes pending heuristic_v1 suggestions for the video, inserts new rows.
 * Safe to call on worker retries (only `suggested` rows are removed).
 */
export async function runHeuristicSuggestedShots(params: {
  db: DB;
  env: WorkerEnv;
  videoId: string;
  inputPath: string;
  durationSeconds: number | null;
}): Promise<number> {
  const { db, env, videoId, inputPath, durationSeconds } = params;

  const log = await runFfmpegSceneDetect(env.FFMPEG_BIN, inputPath);
  let times = parsePtsTimesFromShowinfo(log);
  const maxT =
    durationSeconds != null && durationSeconds > 0 ? durationSeconds + 1 : Number.POSITIVE_INFINITY;
  times = times.filter((t) => t >= 0 && t <= maxT);
  times = mergeNearbyTimes(times);
  times = times.slice(0, MAX_SUGGESTIONS);

  await db
    .delete(suggestedShotEvents)
    .where(
      and(
        eq(suggestedShotEvents.videoId, videoId),
        eq(suggestedShotEvents.source, "heuristic_v1"),
        eq(suggestedShotEvents.status, "suggested"),
      ),
    );

  if (times.length === 0) {
    return 0;
  }

  const rows = times.map((timestampSeconds, i) => ({
    videoId,
    timestampSeconds,
    confidence: confidenceForIndex(i, times.length),
    source: "heuristic_v1" as const,
    status: "suggested" as const,
  }));

  await db.insert(suggestedShotEvents).values(rows);
  return rows.length;
}
