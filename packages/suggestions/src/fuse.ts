import type { SuggestionHeuristicConfig } from "./config.js";
import type { FuseStats, FusedSuggestion, SignalHit, SignalKind } from "./types.js";

function normalizeKind(hits: SignalHit[], kind: SignalKind): SignalHit[] {
  const subset = hits.filter((h) => h.kind === kind);
  if (subset.length === 0) return [];
  const max = Math.max(...subset.map((h) => h.score), 1e-6);
  return subset.map((h) => ({ ...h, score: h.score / max }));
}

type Cluster = {
  t: number;
  hits: SignalHit[];
};

export function clusterSignalHits(hits: SignalHit[], mergeGapSec: number): Cluster[] {
  const sorted = [...hits].sort((a, b) => a.t - b.t);
  if (sorted.length === 0) return [];
  const clusters: Cluster[] = [];
  let cur: SignalHit[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const h = sorted[i]!;
    if (h.t - cur[cur.length - 1]!.t <= mergeGapSec) {
      cur.push(h);
    } else {
      const t = cur.reduce((s, x) => s + x.t, 0) / cur.length;
      clusters.push({ t, hits: cur });
      cur = [h];
    }
  }
  const t = cur.reduce((s, x) => s + x.t, 0) / cur.length;
  clusters.push({ t, hits: cur });
  return clusters;
}

function bestScoreInCluster(cluster: Cluster, kind: SignalKind): number | null {
  const scores = cluster.hits.filter((h) => h.kind === kind).map((h) => h.score);
  if (scores.length === 0) return null;
  return Math.max(...scores);
}

function fuseCluster(
  cluster: Cluster,
  config: SuggestionHeuristicConfig,
): { suggestion: FusedSuggestion; passesThreshold: boolean } {
  const w = config.weights;
  const sceneScore = bestScoreInCluster(cluster, "scene");
  const audioScore = bestScoreInCluster(cluster, "audio");
  const motionScore = bestScoreInCluster(cluster, "motion");

  let weightSum = 0;
  let confidence = 0;
  const parts: string[] = [];

  if (sceneScore != null) {
    confidence += w.scene * sceneScore;
    weightSum += w.scene;
    parts.push("scene");
  }
  if (audioScore != null) {
    confidence += w.audio * audioScore;
    weightSum += w.audio;
    parts.push("audio");
  }
  if (motionScore != null) {
    confidence += w.motion * motionScore;
    weightSum += w.motion;
    parts.push("motion");
  }

  if (weightSum === 0) {
    confidence = 0;
  } else {
    confidence = confidence / weightSum;
  }

  confidence = Math.round(Math.min(1, Math.max(0, confidence)) * 1000) / 1000;

  const audioPeakDb =
    cluster.hits
      .filter((h) => h.kind === "audio")
      .map((h) => h.score)
      .sort((a, b) => b - a)[0] ?? null;

  const reason =
    parts.length > 0
      ? `${parts.join("+")} (${(confidence * 100).toFixed(0)}%)`
      : `heuristic (${(confidence * 100).toFixed(0)}%)`;

  const suggestion: FusedSuggestion = {
    timestampSeconds: cluster.t,
    confidence,
    reason,
    audioPeak: audioPeakDb,
    motionScore: motionScore,
    sceneScore: sceneScore,
    debug: {
      sceneScore: sceneScore ?? undefined,
      audioPeak: audioPeakDb ?? undefined,
      motionScore: motionScore ?? undefined,
      signalWeights: { ...w },
    },
  };

  return { suggestion, passesThreshold: confidence >= config.minConfidence && weightSum > 0 };
}

/** Enforce minimum spacing; prefer higher confidence first. */
export function applyMinSpacing(
  candidates: FusedSuggestion[],
  minSpacingSec: number,
  maxCount: number,
): { picked: FusedSuggestion[]; suppressedSpacing: number } {
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
  const picked: FusedSuggestion[] = [];
  let suppressedSpacing = 0;

  for (const c of sorted) {
    if (picked.length >= maxCount) {
      suppressedSpacing += 1;
      continue;
    }
    const tooClose = picked.some((p) => Math.abs(p.timestampSeconds - c.timestampSeconds) < minSpacingSec);
    if (tooClose) {
      suppressedSpacing += 1;
      continue;
    }
    picked.push(c);
  }

  picked.sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  return { picked, suppressedSpacing };
}

/** Drop isolated hits that are far from neighbors when maxSpacing is set (rally gap heuristic). */
export function applyMaxSpacingGap(
  candidates: FusedSuggestion[],
  maxSpacingSec: number | null,
): { kept: FusedSuggestion[]; suppressed: number } {
  if (maxSpacingSec == null || candidates.length <= 2) {
    return { kept: candidates, suppressed: 0 };
  }
  const sorted = [...candidates].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  const kept: FusedSuggestion[] = [];
  let suppressed = 0;
  for (let i = 0; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    const cur = sorted[i]!;
    const gapPrev = prev ? cur.timestampSeconds - prev.timestampSeconds : Infinity;
    const gapNext = next ? next.timestampSeconds - cur.timestampSeconds : Infinity;
    const minGap = Math.min(gapPrev, gapNext);
    if (minGap > maxSpacingSec) {
      suppressed += 1;
      continue;
    }
    kept.push(cur);
  }
  return { kept, suppressed };
}

export function fuseSignalHits(
  rawHits: SignalHit[],
  config: SuggestionHeuristicConfig,
  durationSeconds: number | null,
): { suggestions: FusedSuggestion[]; stats: FuseStats } {
  const maxT =
    durationSeconds != null && durationSeconds > 0 ? durationSeconds + 1 : Number.POSITIVE_INFINITY;

  const normalized = [
    ...normalizeKind(rawHits, "scene"),
    ...normalizeKind(rawHits, "audio"),
    ...normalizeKind(rawHits, "motion"),
  ].filter((h) => h.t >= 0 && h.t <= maxT);

  const clusters = clusterSignalHits(normalized, config.mergeGapSec);
  let suppressedBelowThreshold = 0;
  const fused: FusedSuggestion[] = [];

  for (const cluster of clusters) {
    const { suggestion, passesThreshold } = fuseCluster(cluster, config);
    if (passesThreshold) {
      fused.push(suggestion);
    } else {
      suppressedBelowThreshold += 1;
    }
  }

  const { kept: afterGap, suppressed: gapSuppressed } = applyMaxSpacingGap(
    fused,
    config.maxSpacingSec,
  );
  const { picked, suppressedSpacing } = applyMinSpacing(
    afterGap,
    config.minSpacingSec,
    config.maxSuggestions,
  );

  const suppressedMaxCount = Math.max(
    0,
    afterGap.length - picked.length - suppressedSpacing,
  );

  const avgConfidence =
    picked.length > 0
      ? Math.round((picked.reduce((s, p) => s + p.confidence, 0) / picked.length) * 1000) / 1000
      : 0;

  return {
    suggestions: picked,
    stats: {
      rawCandidateCount: normalized.length,
      mergedClusterCount: clusters.length,
      suppressedBelowThreshold,
      suppressedSpacing: suppressedSpacing + gapSuppressed,
      suppressedMaxCount,
      outputCount: picked.length,
      avgConfidence,
    },
  };
}
