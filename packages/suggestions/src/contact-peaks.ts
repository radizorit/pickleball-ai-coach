import type { SuggestionHeuristicConfig } from "./config.js";
import type { EnergySample } from "./signals/visual-energy.js";
import type { ProposedRallySegment } from "./rally-segments.js";
import type { FusedSuggestion } from "./types.js";

function localMaxima(
  samples: EnergySample[],
  minSpacingSec: number,
): Array<{ t: number; energy: number; sharpness: number }> {
  const peaks: Array<{ t: number; energy: number; sharpness: number }> = [];
  for (let i = 1; i < samples.length - 1; i++) {
    const prev = samples[i - 1]!;
    const cur = samples[i]!;
    const next = samples[i + 1]!;
    if (cur.energy >= prev.energy && cur.energy >= next.energy && cur.energy > 0.2) {
      const sharpness = cur.energy - (prev.energy + next.energy) / 2;
      peaks.push({ t: cur.t, energy: cur.energy, sharpness });
    }
  }

  peaks.sort((a, b) => b.sharpness - a.sharpness);
  const picked: typeof peaks = [];
  for (const p of peaks) {
    if (picked.some((x) => Math.abs(x.t - p.t) < minSpacingSec)) continue;
    picked.push(p);
    if (picked.length >= 50) break;
  }
  return picked.sort((a, b) => a.t - b.t);
}

/**
 * Contact candidates inside each proposed rally from motion energy peaks.
 */
export function fuseContactsPerRally(
  segments: ProposedRallySegment[],
  samples: EnergySample[],
  config: SuggestionHeuristicConfig,
  rallyIndexById: Map<number, number>,
): { suggestions: FusedSuggestion[]; stats: { rallyCount: number; contactCount: number } } {
  const suggestions: FusedSuggestion[] = [];
  let contactCount = 0;

  segments.forEach((seg, rallyIdx) => {
    const t0 = seg.startTimeSeconds + config.rallyEdgeTrimSec;
    const t1 = seg.endTimeSeconds - config.rallyEdgeTrimSec;
    if (t1 <= t0) return;

    const window = samples.filter((s) => s.t >= t0 && s.t <= t1);
    if (window.length < 2) return;

    const peaks = localMaxima(window, config.contactMinSpacingSec);
    const ranked = [...peaks].sort((a, b) => b.sharpness - a.sharpness).slice(0, config.maxContactsPerRally);
    ranked.sort((a, b) => a.t - b.t);

    const isLast = (t: number) =>
      ranked.length > 0 && Math.abs(ranked[ranked.length - 1]!.t - t) < 0.05;

    for (const p of ranked) {
      const confidence = Math.min(
        1,
        Math.round((0.4 * p.energy + 0.35 * (p.sharpness / Math.max(0.01, p.energy)) + 0.25 * seg.confidence) * 1000) /
          1000,
      );
      if (confidence < config.minConfidence) continue;

      const rallyNum = rallyIndexById.get(rallyIdx) ?? rallyIdx + 1;
      const endLikely = isLast(p.t);
      suggestions.push({
        timestampSeconds: p.t,
        confidence,
        reason: `contact rally #${rallyNum} (${(confidence * 100).toFixed(0)}%)`,
        audioPeak: null,
        motionScore: p.energy,
        sceneScore: null,
        debug: {
          motionScore: p.energy,
          signalWeights: { ...config.weights },
          kind: "contact" as const,
          proposedRallyIndex: rallyIdx,
          endOfRallyLikely: endLikely,
        },
      });
      contactCount += 1;
    }
  });

  return { suggestions, stats: { rallyCount: segments.length, contactCount } };
}
