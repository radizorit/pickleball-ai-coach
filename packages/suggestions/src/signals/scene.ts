import { runCapture } from "../run-capture.js";

/** Parse ffmpeg float tokens (supports scientific notation). */
export function parseFloatToken(raw: string): number {
  const n = Number(raw.replace(/[,;)]*$/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Parse `pts_time` + `scene:` from ffmpeg showinfo.
 * Handles split lines (pts on one line, scene on the next) and scientific `pts_time`.
 */
export function parseShowinfoHits(
  log: string,
  kind: "scene" | "motion",
): Array<{ t: number; score: number }> {
  const lines = log.split(/\r?\n/);
  const hits: Array<{ t: number; score: number }> = [];
  let lastPts: number | null = null;

  for (const line of lines) {
    const ptsM = /pts_time:\s*(\S+)/.exec(line);
    if (ptsM) {
      const t = parseFloatToken(ptsM[1]!);
      if (Number.isFinite(t) && t >= 0) {
        lastPts = t;
      }
    }

    const sceneM = /scene:\s*(\S+)/.exec(line);
    if (!sceneM) continue;

    const linePtsM = /pts_time:\s*(\S+)/.exec(line);
    const tThis = linePtsM ? parseFloatToken(linePtsM[1]!) : NaN;
    const t = Number.isFinite(tThis) && tThis >= 0 ? tThis : lastPts;
    if (t == null || !Number.isFinite(t)) continue;

    const scoreRaw = parseFloatToken(sceneM[1]!);
    const scoreDefault = kind === "scene" ? 0.5 : 0.35;
    const score = Number.isFinite(scoreRaw)
      ? Math.min(1, Math.max(0, scoreRaw))
      : scoreDefault;
    hits.push({ t, score });
  }

  return hits;
}

function buildSceneMotionFilter(threshold: number, sampleFps: number | null): string {
  const fpsPart = sampleFps != null && sampleFps > 0 ? `fps=${sampleFps},` : "";
  return `${fpsPart}setpts=PTS-STARTPTS,select='gt(scene,${threshold})',showinfo`;
}

export async function detectSceneHits(
  ffmpegBin: string,
  inputPath: string,
  threshold: number,
  sampleFps: number | null,
): Promise<Array<{ t: number; score: number }>> {
  try {
    const log = await runCapture(ffmpegBin, [
      "-hide_banner",
      "-nostats",
      "-i",
      inputPath,
      "-filter:v",
      buildSceneMotionFilter(threshold, sampleFps),
      "-f",
      "null",
      "-",
    ]);
    return parseShowinfoHits(log, "scene");
  } catch {
    return [];
  }
}

export async function detectMotionHits(
  ffmpegBin: string,
  inputPath: string,
  threshold: number,
  sampleFps: number | null,
): Promise<Array<{ t: number; score: number }>> {
  try {
    const log = await runCapture(ffmpegBin, [
      "-hide_banner",
      "-nostats",
      "-i",
      inputPath,
      "-filter:v",
      buildSceneMotionFilter(threshold, sampleFps),
      "-f",
      "null",
      "-",
    ]);
    return parseShowinfoHits(log, "motion");
  } catch {
    return [];
  }
}
