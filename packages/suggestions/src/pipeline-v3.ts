import { and, eq, inArray } from "@pickleball/db";
import { suggestedRallies, suggestedShotEvents } from "@pickleball/db/schema";
import type { DB } from "@pickleball/db";
import type { SuggestedShotDebugMetadata } from "@pickleball/db/schema";

import type { CourtCornersNormalized, SuggestionHeuristicConfig, SuggestionMediaEnv } from "./config.js";
import { fuseContactsPerRally } from "./contact-peaks.js";
import { proposeRallySegments } from "./rally-segments.js";
import { detectAudioHits } from "./signals/audio.js";
import { detectVisualEnergyCurve } from "./signals/visual-energy.js";
import type { SuggestionPipelineResult } from "./pipeline.js";

function shouldLogPipelineDebug(): boolean {
  const v = process.env.SUGGESTION_DEBUG_PIPELINE;
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Visual rally pipeline: motion energy curve → proposed rallies → per-rally contact peaks.
 */
export async function runSuggestionPipelineV3(params: {
  db: DB;
  env: SuggestionMediaEnv;
  videoId: string;
  inputPath: string;
  durationSeconds: number | null;
  config: SuggestionHeuristicConfig;
  courtCorners?: CourtCornersNormalized | null;
}): Promise<SuggestionPipelineResult> {
  const { db, env, videoId, inputPath, durationSeconds, config, courtCorners } = params;
  const generatedAt = new Date().toISOString();

  const samples = await detectVisualEnergyCurve(
    env.FFMPEG_BIN,
    inputPath,
    config.sceneSampleFps,
    courtCorners,
  );

  if (shouldLogPipelineDebug()) {
    console.info(`[suggestions:v3] video=${videoId} energySamples=${samples.length}`);
  }

  const segments = proposeRallySegments(samples, config, durationSeconds);

  const rallyIndexMap = new Map<number, number>();
  segments.forEach((_, i) => rallyIndexMap.set(i, i + 1));

  const { suggestions, stats: contactStats } = fuseContactsPerRally(
    segments,
    samples,
    config,
    rallyIndexMap,
  );

  let audioBoost = 0;
  if (config.enableAudio) {
    const audioHits = await detectAudioHits(env.FFMPEG_BIN, inputPath, config.audioPeakDbThreshold);
    for (const s of suggestions) {
      const near = audioHits.some((a) => Math.abs(a.t - s.timestampSeconds) < 0.35);
      if (near) audioBoost += 1;
    }
  }

  const shotRows = suggestions.map((s) => {
    const debugMetadata: SuggestedShotDebugMetadata = {
      generatedAt,
      pipelineVersion: "heuristic_v3",
      sceneScore: s.debug.sceneScore,
      audioPeak: s.debug.audioPeak,
      motionScore: s.debug.motionScore,
      signalWeights: s.debug.signalWeights,
      kind: s.debug.kind,
      proposedRallyIndex: s.debug.proposedRallyIndex,
      endOfRallyLikely: s.debug.endOfRallyLikely,
      proposedRallyCount: segments.length,
      contactCount: contactStats.contactCount,
    };
    return {
      videoId,
      timestampSeconds: s.timestampSeconds,
      confidence: s.confidence,
      source: "heuristic_v3" as const,
      status: "suggested" as const,
      reason: s.reason,
      audioPeak: s.audioPeak,
      motionScore: s.motionScore,
      debugMetadata,
    };
  });

  const rallyRows = segments.map((seg, idx) => ({
    videoId,
    proposalIndex: idx,
    startTimeSeconds: seg.startTimeSeconds,
    endTimeSeconds: seg.endTimeSeconds,
    confidence: seg.confidence,
    status: "suggested" as const,
    debugMetadata: {
      generatedAt,
      meanEnergy: seg.meanEnergy,
      pipelineVersion: "heuristic_v3",
    },
  }));

  await db.transaction(async (tx) => {
    await tx
      .delete(suggestedShotEvents)
      .where(
        and(
          eq(suggestedShotEvents.videoId, videoId),
          inArray(suggestedShotEvents.source, ["heuristic_v1", "heuristic_v2", "heuristic_v3"]),
          eq(suggestedShotEvents.status, "suggested"),
        ),
      );
    await tx
      .delete(suggestedRallies)
      .where(
        and(eq(suggestedRallies.videoId, videoId), eq(suggestedRallies.status, "suggested")),
      );

    if (rallyRows.length > 0) {
      await tx.insert(suggestedRallies).values(rallyRows);
    }
    if (shotRows.length > 0) {
      await tx.insert(suggestedShotEvents).values(shotRows);
    }
  });

  const avgConfidence =
    shotRows.length > 0
      ? Math.round(
          (shotRows.reduce((sum, r) => sum + r.confidence, 0) / shotRows.length) * 1000,
        ) / 1000
      : 0;

  console.info(
    `[worker] suggestions v3 video=${videoId} rallies=${segments.length} contacts=${shotRows.length} ` +
      `avgConf=${avgConfidence} audioNear=${audioBoost}`,
  );

  return {
    inserted: shotRows.length,
    stats: {
      avgConfidence,
      suppressedBelowThreshold: 0,
      suppressedSpacing: 0,
      mergedClusterCount: segments.length,
      rawCandidateCount: samples.length,
      afterConfidenceCount: shotRows.length,
      afterMaxGapCount: shotRows.length,
      outputCount: shotRows.length,
      proposedRallyCount: segments.length,
    },
  };
}
