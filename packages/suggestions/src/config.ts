/** ffmpeg binary paths used by signal extractors. */
export type SuggestionMediaEnv = {
  FFMPEG_BIN: string;
};

/** Normalized court corner (0–1) for ROI crop; order: near-left, near-right, far-right, far-left. */
export type CourtCornersNormalized = [
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
];

/** Tunable heuristic parameters (env overrides for local debugging). */
export type SuggestionHeuristicConfig = {
  /** `v2` = legacy scene/audio/motion fuse; `v3` = visual rally (default). */
  pipelineVersion: "v2" | "v3";
  sceneThreshold: number;
  motionThreshold: number;
  audioPeakDbThreshold: number;
  enableAudio: boolean;
  mergeGapSec: number;
  minSpacingSec: number;
  maxSpacingSec: number | null;
  minConfidence: number;
  maxSuggestions: number;
  weights: { scene: number; audio: number; motion: number };
  sceneSampleFps: number | null;
  /** v3: stillness threshold (normalized motion energy 0–1). */
  stillnessThreshold: number;
  /** v3: minimum stillness duration to split rallies (seconds). */
  stillnessMinSec: number;
  /** v3: minimum rally active duration (seconds). */
  rallyMinSec: number;
  /** v3: merge rally gaps shorter than this (seconds). */
  rallyMergeGapSec: number;
  /** v3: min spacing between contact peaks inside a rally. */
  contactMinSpacingSec: number;
  /** v3: max contact suggestions per rally. */
  maxContactsPerRally: number;
  /** v3: trim contact candidates near rally edges (seconds). */
  rallyEdgeTrimSec: number;
  /** v3: max proposed rallies per video. */
  maxProposedRallies: number;
};

function envNum(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw == null || raw === "") return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
}

export function loadSuggestionHeuristicConfig(_env?: SuggestionMediaEnv): SuggestionHeuristicConfig {
  const maxSpacingRaw = process.env.SUGGESTION_MAX_SPACING_SEC;
  const maxSpacing =
    maxSpacingRaw != null && maxSpacingRaw !== "" ? Number(maxSpacingRaw) : null;

  const sampleRaw = process.env.SUGGESTION_SCENE_SAMPLE_FPS;
  let sceneSampleFps: number | null = 8;
  if (sampleRaw != null && sampleRaw !== "") {
    const n = Number(sampleRaw);
    sceneSampleFps = Number.isFinite(n) && n > 0 ? n : null;
  }

  const pipelineRaw = process.env.SUGGESTION_PIPELINE_VERSION?.trim().toLowerCase();
  const pipelineVersion = pipelineRaw === "v2" ? "v2" : "v3";

  return {
    pipelineVersion,
    sceneThreshold: envNum("SUGGESTION_SCENE_THRESHOLD", 0.28),
    motionThreshold: envNum("SUGGESTION_MOTION_THRESHOLD", 0.18),
    audioPeakDbThreshold: envNum("SUGGESTION_AUDIO_PEAK_DB", -28),
    enableAudio: envBool("SUGGESTION_ENABLE_AUDIO", false),
    mergeGapSec: envNum("SUGGESTION_MERGE_GAP_SEC", 0.45),
    minSpacingSec: envNum("SUGGESTION_MIN_SPACING_SEC", 0.55),
    maxSpacingSec: Number.isFinite(maxSpacing) && maxSpacing! > 0 ? maxSpacing : null,
    minConfidence: envNum("SUGGESTION_MIN_CONFIDENCE", 0.38),
    maxSuggestions: Math.max(1, Math.floor(envNum("SUGGESTION_MAX_COUNT", 80))),
    weights: {
      scene: envNum("SUGGESTION_WEIGHT_SCENE", 0.45),
      audio: envNum("SUGGESTION_WEIGHT_AUDIO", 0.08),
      motion: envNum("SUGGESTION_WEIGHT_MOTION", 0.47),
    },
    sceneSampleFps,
    stillnessThreshold: envNum("SUGGESTION_STILLNESS_THRESHOLD", 0.12),
    stillnessMinSec: envNum("SUGGESTION_STILLNESS_MIN_SEC", 2.5),
    rallyMinSec: envNum("SUGGESTION_RALLY_MIN_SEC", 3),
    rallyMergeGapSec: envNum("SUGGESTION_RALLY_MERGE_GAP_SEC", 3),
    contactMinSpacingSec: envNum("SUGGESTION_CONTACT_MIN_SPACING_SEC", 0.55),
    maxContactsPerRally: Math.max(1, Math.floor(envNum("SUGGESTION_MAX_CONTACTS_PER_RALLY", 14))),
    rallyEdgeTrimSec: envNum("SUGGESTION_RALLY_EDGE_TRIM_SEC", 0.5),
    maxProposedRallies: Math.max(1, Math.floor(envNum("SUGGESTION_MAX_PROPOSED_RALLIES", 40))),
  };
}
