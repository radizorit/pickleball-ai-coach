import { and, eq } from "@pickleball/db";
import { suggestedShotEvents } from "@pickleball/db/schema";
import type { DB } from "@pickleball/db";
import type { SuggestedShotDebugMetadata } from "@pickleball/db/schema";

import { loadSuggestionHeuristicConfig, type SuggestionMediaEnv } from "./config.js";
import { fuseSignalHits } from "./fuse.js";
import { detectAudioHits } from "./signals/audio.js";
import { detectMotionHits, detectSceneHits } from "./signals/scene.js";
import type { SignalHit } from "./types.js";

export type SuggestionPipelineResult = {
  inserted: number;
  stats: {
    avgConfidence: number;
    suppressedBelowThreshold: number;
    suppressedSpacing: number;
    mergedClusterCount: number;
    rawCandidateCount: number;
  };
};

/**
 * Multi-signal heuristic pipeline: scene + audio peaks + motion spikes → fused confidence.
 * Deletes pending `heuristic_v1` rows before insert (idempotent worker retries).
 */
export async function runSuggestionPipeline(params: {
  db: DB;
  env: SuggestionMediaEnv;
  videoId: string;
  inputPath: string;
  durationSeconds: number | null;
}): Promise<SuggestionPipelineResult> {
  const { db, env, videoId, inputPath, durationSeconds } = params;
  const config = loadSuggestionHeuristicConfig(env);
  const generatedAt = new Date().toISOString();

  const [sceneHits, audioHits, motionHits] = await Promise.all([
    detectSceneHits(env.FFMPEG_BIN, inputPath, config.sceneThreshold),
    detectAudioHits(env.FFMPEG_BIN, inputPath, config.audioPeakDbThreshold),
    detectMotionHits(env.FFMPEG_BIN, inputPath, config.motionThreshold),
  ]);

  const rawHits: SignalHit[] = [
    ...sceneHits.map((h) => ({ t: h.t, score: h.score, kind: "scene" as const })),
    ...audioHits.map((h) => ({ t: h.t, score: h.score, kind: "audio" as const })),
    ...motionHits.map((h) => ({ t: h.t, score: h.score, kind: "motion" as const })),
  ];

  const { suggestions, stats } = fuseSignalHits(rawHits, config, durationSeconds);

  const rows = suggestions.map((s) => {
    const debugMetadata: SuggestedShotDebugMetadata = {
      generatedAt,
      pipelineVersion: "heuristic_v2",
      sceneScore: s.debug.sceneScore,
      audioPeak: s.debug.audioPeak,
      motionScore: s.debug.motionScore,
      signalWeights: s.debug.signalWeights,
      rawCandidateCount: stats.rawCandidateCount,
      mergedClusterCount: stats.mergedClusterCount,
      suppressedBelowThreshold: stats.suppressedBelowThreshold,
      suppressedSpacing: stats.suppressedSpacing,
      suppressedMaxCount: stats.suppressedMaxCount,
    };
    return {
      videoId,
      timestampSeconds: s.timestampSeconds,
      confidence: s.confidence,
      source: "heuristic_v1" as const,
      status: "suggested" as const,
      reason: s.reason,
      audioPeak: s.audioPeak,
      motionScore: s.motionScore,
      debugMetadata,
    };
  });

  await db.transaction(async (tx) => {
    await tx
      .delete(suggestedShotEvents)
      .where(
        and(
          eq(suggestedShotEvents.videoId, videoId),
          eq(suggestedShotEvents.source, "heuristic_v1"),
          eq(suggestedShotEvents.status, "suggested"),
        ),
      );
    if (rows.length > 0) {
      await tx.insert(suggestedShotEvents).values(rows);
    }
  });

  if (rows.length === 0) {
    console.info(
      `[worker] suggestions video=${videoId} generated=0 avgConf=0 merged=${stats.mergedClusterCount} ` +
        `suppressed_threshold=${stats.suppressedBelowThreshold} spacing=${stats.suppressedSpacing}`,
    );
    return {
      inserted: 0,
      stats: {
        avgConfidence: 0,
        suppressedBelowThreshold: stats.suppressedBelowThreshold,
        suppressedSpacing: stats.suppressedSpacing,
        mergedClusterCount: stats.mergedClusterCount,
        rawCandidateCount: stats.rawCandidateCount,
      },
    };
  }

  console.info(
    `[worker] suggestions video=${videoId} generated=${rows.length} avgConf=${stats.avgConfidence} ` +
      `merged=${stats.mergedClusterCount} raw=${stats.rawCandidateCount} ` +
      `suppressed_threshold=${stats.suppressedBelowThreshold} spacing=${stats.suppressedSpacing}`,
  );

  return {
    inserted: rows.length,
    stats: {
      avgConfidence: stats.avgConfidence,
      suppressedBelowThreshold: stats.suppressedBelowThreshold,
      suppressedSpacing: stats.suppressedSpacing,
      mergedClusterCount: stats.mergedClusterCount,
      rawCandidateCount: stats.rawCandidateCount,
    },
  };
}
