import { runCapture } from "../run-capture.js";

/**
 * Parse ffmpeg `ametadata` lines for per-window peak/RMS (dB).
 * Returns normalized 0–1 scores where louder = higher.
 */
export function parseAudioPeakHits(log: string, peakDbThreshold: number): Array<{ t: number; score: number }> {
  const hits: Array<{ t: number; score: number }> = [];
  const lines = log.split(/\r?\n/);
  for (const line of lines) {
    const tMatch = /pts_time:\s*([\d.]+)/.exec(line);
    if (!tMatch) continue;
    const t = Number(tMatch[1]);
    if (!Number.isFinite(t) || t < 0) continue;

    const peakMatch =
      /lavfi\.astats\.Overall\.Peak_level=([-\d.inf]+)/.exec(line) ??
      /Peak_level=([-\d.inf]+)/.exec(line);
    const rmsMatch =
      /lavfi\.astats\.Overall\.RMS_level=([-\d.inf]+)/.exec(line) ??
      /RMS_level=([-\d.inf]+)/.exec(line);

    const dbRaw = peakMatch?.[1] ?? rmsMatch?.[1];
    if (dbRaw == null || dbRaw === "-inf") continue;
    const db = Number(dbRaw);
    if (!Number.isFinite(db)) continue;
    if (db < peakDbThreshold) continue;

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
      "aformat=channel_layouts=mono,aresample=8000,asetnsamples=8000,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.Peak_level,ametadata=print:key=lavfi.astats.Overall.RMS_level",
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
