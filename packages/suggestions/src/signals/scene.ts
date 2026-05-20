import { runCapture } from "../run-capture.js";

/** Parse `pts_time` and optional `scene:` from ffmpeg showinfo lines. */
export function parseShowinfoHits(
  log: string,
  kind: "scene" | "motion",
): Array<{ t: number; score: number }> {
  const lines = log.split(/\r?\n/);
  const hits: Array<{ t: number; score: number }> = [];
  for (const line of lines) {
    const tMatch = /pts_time:\s*([\d.]+)/.exec(line);
    if (!tMatch) continue;
    const t = Number(tMatch[1]);
    if (!Number.isFinite(t) || t < 0) continue;
    const sceneMatch = /scene:\s*([\d.]+)/.exec(line);
    const score = sceneMatch ? Number(sceneMatch[1]) : kind === "scene" ? 0.5 : 0.35;
    if (!Number.isFinite(score)) continue;
    hits.push({ t, score: Math.min(1, Math.max(0, score)) });
  }
  return hits;
}

export async function detectSceneHits(
  ffmpegBin: string,
  inputPath: string,
  threshold: number,
): Promise<Array<{ t: number; score: number }>> {
  const log = await runCapture(ffmpegBin, [
    "-hide_banner",
    "-nostats",
    "-i",
    inputPath,
    "-filter:v",
    `select='gt(scene,${threshold})',showinfo`,
    "-f",
    "null",
    "-",
  ]);
  return parseShowinfoHits(log, "scene");
}

export async function detectMotionHits(
  ffmpegBin: string,
  inputPath: string,
  threshold: number,
): Promise<Array<{ t: number; score: number }>> {
  const log = await runCapture(ffmpegBin, [
    "-hide_banner",
    "-nostats",
    "-i",
    inputPath,
    "-filter:v",
    `select='gt(scene,${threshold})',showinfo`,
    "-f",
    "null",
    "-",
  ]);
  return parseShowinfoHits(log, "motion");
}
