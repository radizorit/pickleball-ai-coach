import { and, eq, inArray } from "@pickleball/db";
import { suggestedShotEvents } from "@pickleball/db/schema";
import type { DB } from "@pickleball/db";
import type { SuggestedShotDebugMetadata } from "@pickleball/db/schema";

import type { CourtCornersNormalized } from "./config.js";
import { loadSuggestionHeuristicConfig, type SuggestionHeuristicConfig, type SuggestionMediaEnv } from "./config.js";
import { fuseSignalHits } from "./fuse.js";
import { runSuggestionPipelineV3 } from "./pipeline-v3.js";
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
    afterConfidenceCount: number;
    afterMaxGapCount: number;
    outputCount: number;
    proposedRallyCount?: number;
  };
};

function shouldLogPipelineDebug(): boolean {
  const v = process.env.SUGGESTION_DEBUG_PIPELINE;
  return v === "1" || v === "true" || v === "yes";
}

function summarizeTimes(hits: Array<{ t: number }>): string {
  if (hits.length === 0) return "count=0";
  const s = [...hits].sort((a, b) => a.t - b.t);
  const head = s.slice(0, 10).map((h) => h.t.toFixed(3));
  const tail = s.slice(-10).map((h) => h.t.toFixed(3));
  return `count=${hits.length} first10=[${head.join(",")}] last10=[${tail.join(",")}]`;
}

function logConfigSnapshot(videoId: string, config: SuggestionHeuristicConfig): void {
  console.info(
    `[suggestions:debug] video=${videoId} env snapshot: ` +
      `MIN_CONFIDENCE=${config.minConfidence} MIN_SPACING_SEC=${config.minSpacingSec} ` +
      `MERGE_GAP_SEC=${config.mergeGapSec} MAX_COUNT=${config.maxSuggestions} ` +
      `MAX_SPACING_SEC=${config.maxSpacingSec ?? "null"} SCENE_SAMPLE_FPS=${config.sceneSampleFps ?? "full"} ` +
      `SCENE_TH=${config.sceneThreshold} MOTION_TH=${config.motionThreshold} AUDIO_DB=${config.audioPeakDbThreshold}`,
  );
}

/**
 * Heuristic suggestion pipeline. Default: visual rally v3; set `SUGGESTION_PIPELINE_VERSION=v2` for legacy fuse.
 */
export async function runSuggestionPipeline(params: {
  db: DB;
  env: SuggestionMediaEnv;
  videoId: string;
  inputPath: string;
  durationSeconds: number | null;
  courtCorners?: CourtCornersNormalized | null;
}): Promise<SuggestionPipelineResult> {
  const { db, env, videoId, inputPath, durationSeconds, courtCorners } = params;
  const config = loadSuggestionHeuristicConfig(env);

  if (config.pipelineVersion === "v3") {
    return runSuggestionPipelineV3({
      db,
      env,
      videoId,
      inputPath,
      durationSeconds,
      config,
      courtCorners,
    });
  }

  const generatedAt = new Date().toISOString();

  if (shouldLogPipelineDebug()) {
    logConfigSnapshot(videoId, config);
  }

  const audioPromise = config.enableAudio
    ? detectAudioHits(env.FFMPEG_BIN, inputPath, config.audioPeakDbThreshold)
    : Promise.resolve([] as Awaited<ReturnType<typeof detectAudioHits>>);

  const [sceneHits, audioHits, motionHits] = await Promise.all([
    detectSceneHits(env.FFMPEG_BIN, inputPath, config.sceneThreshold, config.sceneSampleFps),
    audioPromise,
    detectMotionHits(env.FFMPEG_BIN, inputPath, config.motionThreshold, config.sceneSampleFps),
  ]);

  if (shouldLogPipelineDebug()) {
    console.info(`[suggestions:debug] video=${videoId} rawSceneHits ${summarizeTimes(sceneHits)}`);
    console.info(`[suggestions:debug] video=${videoId} rawMotionHits ${summarizeTimes(motionHits)}`);
    console.info(`[suggestions:debug] video=${videoId} rawAudioHits ${summarizeTimes(audioHits)}`);
  }

  const rawHits: SignalHit[] = [
    ...sceneHits.map((h) => ({ t: h.t, score: h.score, kind: "scene" as const })),
    ...audioHits.map((h) => ({ t: h.t, score: h.score, kind: "audio" as const })),
    ...motionHits.map((h) => ({ t: h.t, score: h.score, kind: "motion" as const })),
  ];

  const { suggestions, stats } = fuseSignalHits(rawHits, config, durationSeconds);

  if (shouldLogPipelineDebug()) {
    console.info(
      `[suggestions:debug] video=${videoId} fuse: rawCandidates=${stats.rawCandidateCount} ` +
        `clusters=${stats.mergedClusterCount} afterConfidence=${stats.afterConfidenceCount} ` +
        `afterMaxGap=${stats.afterMaxGapCount} suppressedBelowTh=${stats.suppressedBelowThreshold} ` +
        `suppressedSpacing=${stats.suppressedSpacing} suppressedMaxCount=${stats.suppressedMaxCount} ` +
        `final=${stats.outputCount} avgConf=${stats.avgConfidence}`,
    );
  }

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
      source: "heuristic_v2" as const,
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
          inArray(suggestedShotEvents.source, ["heuristic_v1", "heuristic_v2"]),
          eq(suggestedShotEvents.status, "suggested"),
        ),
      );
    if (rows.length > 0) {
      await tx.insert(suggestedShotEvents).values(rows);
    }
  });

  const commonStats = {
    avgConfidence: stats.avgConfidence,
    suppressedBelowThreshold: stats.suppressedBelowThreshold,
    suppressedSpacing: stats.suppressedSpacing,
    mergedClusterCount: stats.mergedClusterCount,
    rawCandidateCount: stats.rawCandidateCount,
    afterConfidenceCount: stats.afterConfidenceCount,
    afterMaxGapCount: stats.afterMaxGapCount,
    outputCount: stats.outputCount,
  };

  if (rows.length === 0) {
    console.info(
      `[worker] suggestions video=${videoId} generated=0 avgConf=0 merged=${stats.mergedClusterCount} ` +
        `suppressed_threshold=${stats.suppressedBelowThreshold} spacing=${stats.suppressedSpacing}`,
    );
    return {
      inserted: 0,
      stats: { ...commonStats, avgConfidence: 0 },
    };
  }

  console.info(
    `[worker] suggestions video=${videoId} generated=${rows.length} avgConf=${stats.avgConfidence} ` +
      `merged=${stats.mergedClusterCount} raw=${stats.rawCandidateCount} ` +
      `suppressed_threshold=${stats.suppressedBelowThreshold} spacing=${stats.suppressedSpacing}`,
  );

  return {
    inserted: rows.length,
    stats: commonStats,
  };
}
