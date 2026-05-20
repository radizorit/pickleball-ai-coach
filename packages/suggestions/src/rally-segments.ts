import type { SuggestionHeuristicConfig } from "./config.js";
import type { EnergySample } from "./signals/visual-energy.js";

export type ProposedRallySegment = {
  startTimeSeconds: number;
  endTimeSeconds: number;
  confidence: number;
  meanEnergy: number;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1]! + s[m]!) / 2 : s[m]!;
}

/**
 * Segment motion energy into rally spans between stillness windows.
 */
export function proposeRallySegments(
  samples: EnergySample[],
  config: SuggestionHeuristicConfig,
  durationSeconds: number | null,
): ProposedRallySegment[] {
  if (samples.length < 3) return [];

  const maxT =
    durationSeconds != null && durationSeconds > 0 ? durationSeconds : samples[samples.length - 1]!.t;

  const energies = samples.map((s) => s.energy);
  const med = median(energies);
  const tLow = Math.min(config.stillnessThreshold, med * 0.65);
  const tMid = Math.max(tLow * 1.8, med * 1.1);

  const still: Array<{ start: number; end: number }> = [];
  let runStart: number | null = null;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    const isStill = s.energy < tLow;
    if (isStill && runStart == null) {
      runStart = s.t;
    }
    if (!isStill && runStart != null) {
      const prev = samples[i - 1];
      still.push({ start: runStart, end: prev?.t ?? s.t });
      runStart = null;
    }
  }
  if (runStart != null) {
    still.push({ start: runStart, end: samples[samples.length - 1]!.t });
  }

  const rallies: ProposedRallySegment[] = [];

  for (let i = 0; i < still.length - 1; i++) {
    const gapStart = still[i]!.end;
    const gapEnd = still[i + 1]!.start;
    const gapDur = gapEnd - gapStart;
    if (gapDur < config.rallyMinSec) continue;

    const inGap = samples.filter((s) => s.t >= gapStart && s.t <= gapEnd);
    if (inGap.length === 0) continue;
    const meanE = inGap.reduce((a, s) => a + s.energy, 0) / inGap.length;
    if (meanE < tMid * 0.85) continue;

    const activeRatio = inGap.filter((s) => s.energy >= tMid).length / inGap.length;
    const confidence = Math.min(
      1,
      Math.round((0.35 + activeRatio * 0.45 + Math.min(1, gapDur / 30) * 0.2) * 1000) / 1000,
    );

    rallies.push({
      startTimeSeconds: Math.max(0, gapStart),
      endTimeSeconds: Math.min(maxT, gapEnd),
      confidence,
      meanEnergy: meanE,
    });
  }

  rallies.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

  const merged: ProposedRallySegment[] = [];
  for (const r of rallies) {
    const last = merged[merged.length - 1];
    if (last && r.startTimeSeconds - last.endTimeSeconds < config.rallyMergeGapSec) {
      last.endTimeSeconds = Math.max(last.endTimeSeconds, r.endTimeSeconds);
      last.confidence = Math.max(last.confidence, r.confidence);
      last.meanEnergy = (last.meanEnergy + r.meanEnergy) / 2;
    } else {
      merged.push({ ...r });
    }
  }

  return merged
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, config.maxProposedRallies)
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
}
