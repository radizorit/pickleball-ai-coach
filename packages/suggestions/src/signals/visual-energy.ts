import type { CourtCornersNormalized } from "../config.js";
import { runCapture } from "../run-capture.js";

export type EnergySample = { t: number; energy: number };

function parseFloatToken(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Build ffmpeg crop from normalized quad or center 60% fallback. */
export function buildCropFilter(corners: CourtCornersNormalized | null | undefined): string {
  if (corners && corners.length === 4) {
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const minX = Math.max(0, Math.min(...xs));
    const maxX = Math.min(1, Math.max(...xs));
    const minY = Math.max(0, Math.min(...ys));
    const maxY = Math.min(1, Math.max(...ys));
    const w = Math.max(0.1, maxX - minX);
    const h = Math.max(0.1, maxY - minY);
    return `crop=iw*${w.toFixed(4)}:ih*${h.toFixed(4)}:iw*${minX.toFixed(4)}:ih*${minY.toFixed(4)}`;
  }
  return "crop=iw*0.6:ih*0.6:(iw-ow)/2:(ih-oh)/2";
}

/**
 * Per-frame motion energy curve via fps + grayscale + tblend difference + signalstats metadata.
 * Falls back to [] on ffmpeg failure (caller may use v2 path).
 */
export async function detectVisualEnergyCurve(
  ffmpegBin: string,
  inputPath: string,
  sampleFps: number | null,
  corners?: CourtCornersNormalized | null,
): Promise<EnergySample[]> {
  const fps = sampleFps != null && sampleFps > 0 ? sampleFps : 8;
  const crop = buildCropFilter(corners);
  const vf = [
    `fps=${fps}`,
    crop,
    "format=gray",
    "scale=320:-1",
    "tblend=all_mode=difference",
    "signalstats=metadata=1:frame=1",
    "metadata=mode=print:file=-",
  ].join(",");

  try {
    const out = await runCapture(ffmpegBin, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      inputPath,
      "-an",
      "-vf",
      vf,
      "-f",
      "null",
      "-",
    ]);

    const samples: EnergySample[] = [];
    let lastPts: number | null = null;
    let lastYdif: number | null = null;

    for (const line of out.split("\n")) {
      const ptsMatch = line.match(/pts_time:([0-9.eE+-]+)/);
      if (ptsMatch) {
        const t = parseFloatToken(ptsMatch[1]!);
        if (t != null) {
          if (lastPts != null && lastYdif != null) {
            samples.push({ t: lastPts, energy: lastYdif });
          }
          lastPts = t;
          lastYdif = null;
        }
      }
      const ydifMatch = line.match(/lavfi\.signalstats\.YDIF=([0-9.eE+-]+)/);
      if (ydifMatch) {
        lastYdif = parseFloatToken(ydifMatch[1]!);
      }
      if (lastYdif == null) {
        const yavgMatch = line.match(/lavfi\.signalstats\.YAVG=([0-9.eE+-]+)/);
        if (yavgMatch) {
          lastYdif = parseFloatToken(yavgMatch[1]!);
        }
      }
    }
    if (lastPts != null && lastYdif != null) {
      samples.push({ t: lastPts, energy: lastYdif });
    }

    if (samples.length === 0) {
      return fallbackEnergyFromScene(ffmpegBin, inputPath, fps, crop);
    }

    const maxE = Math.max(...samples.map((s) => s.energy), 1e-6);
    return samples.map((s) => ({
      t: s.t,
      energy: Math.min(1, Math.max(0, s.energy / maxE)),
    }));
  } catch {
    return fallbackEnergyFromScene(ffmpegBin, inputPath, fps, crop);
  }
}

/** Sparse scene hits on ROI as coarse energy samples when signalstats print fails. */
async function fallbackEnergyFromScene(
  ffmpegBin: string,
  inputPath: string,
  fps: number,
  crop: string,
): Promise<EnergySample[]> {
  const { detectMotionHits } = await import("./scene.js");
  const hits = await detectMotionHits(ffmpegBin, inputPath, 0.12, fps);
  if (hits.length === 0) return [];
  return hits.map((h) => ({ t: h.t, energy: h.score }));
}
