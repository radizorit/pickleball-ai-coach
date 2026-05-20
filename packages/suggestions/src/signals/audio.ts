import { runCapture } from "../run-capture.js";

import { parseFloatToken } from "./scene.js";

/**
 * Parse ffmpeg `ametadata` lines for per-window peak/RMS (dB).
 * `pts_time` and level keys often land on different lines; carry the latest pts forward.
 */
export function parseAudioPeakHits(log: string, peakDbThreshold: number): Array<{ t: number; score: number }> {
  const hits: Array<{ t: number; score: number }> = [];
  const lines = log.split(/\r?\n/);
  let lastPts: number | null = null;

  for (const line of lines) {
    const ptsM = /pts_time:\s*(\S+)/.exec(line);
    if (ptsM) {
      const t = parseFloatToken(ptsM[1]!);
      if (Number.isFinite(t) && t >= 0) {
        lastPts = t;
      }
    }

    const peakMatch =
      /lavfi\.astats\.Overall\.Peak_level=(\S+)/.exec(line) ??
      /Peak_level=(\S+)/.exec(line);
    const rmsMatch =
      /lavfi\.astats\.Overall\.RMS_level=(\S+)/.exec(line) ??
      /RMS_level=(\S+)/.exec(line);

    const dbRaw = peakMatch?.[1] ?? rmsMatch?.[1];
    if (dbRaw == null || dbRaw === "-inf") continue;
    const db = parseFloatToken(dbRaw);
    if (!Number.isFinite(db)) continue;
    if (db < peakDbThreshold) continue;

    const linePtsM = /pts_time:\s*(\S+)/.exec(line);
    const tThis = linePtsM ? parseFloatToken(linePtsM[1]!) : NaN;
    const t = Number.isFinite(tThis) && tThis >= 0 ? tThis : lastPts;
    if (t == null || !Number.isFinite(t)) continue;

    const span = 0 - peakDbThreshold;
    const score = Math.min(1, Math.max(0, (db - peakDbThreshold) / span));
    hits.push({ t, score });
  }
  return hits;
}

export async function detectAudioHits(
  ffmpegBin: string,
  inputPath: string,
  peakDbThreshold: number,
): Promise<Array<{ t: number; score: number }>> {
  try {
    const log = await runCapture(ffmpegBin, [
      "-hide_banner",
      "-nostats",
      "-i",
      inputPath,
      "-af",
      "asetpts=PTS-STARTPTS,aformat=channel_layouts=mono,aresample=8000,asetnsamples=8000,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.Peak_level,ametadata=print:key=lavfi.astats.Overall.RMS_level",
      "-vn",
      "-f",
      "null",
      "-",
    ]);
    return parseAudioPeakHits(log, peakDbThreshold);
  } catch {
    return [];
  }
}
