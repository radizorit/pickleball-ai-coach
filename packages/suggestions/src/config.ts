/** ffmpeg binary paths used by signal extractors. */
export type SuggestionMediaEnv = {
  FFMPEG_BIN: string;
};

/** Tunable heuristic parameters (env overrides for local debugging). */
export type SuggestionHeuristicConfig = {
  sceneThreshold: number;
  motionThreshold: number;
  audioPeakDbThreshold: number;
  mergeGapSec: number;
  minSpacingSec: number;
  maxSpacingSec: number | null;
  minConfidence: number;
  maxSuggestions: number;
  weights: { scene: number; audio: number; motion: number };
  /**
   * When > 0, scene/motion filters use `fps=N` before `select` so consecutive *decoded*
   * frames are compared (fixes sparse keyframe / long-GOP decode where `scene` rarely fires).
   * Set `SUGGESTION_SCENE_SAMPLE_FPS=0` to force full-rate decode (slow on long clips).
   */
  sceneSampleFps: number | null;
};

function envNum(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
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

  return {
    sceneThreshold: envNum("SUGGESTION_SCENE_THRESHOLD", 0.28),
    motionThreshold: envNum("SUGGESTION_MOTION_THRESHOLD", 0.18),
    audioPeakDbThreshold: envNum("SUGGESTION_AUDIO_PEAK_DB", -28),
    mergeGapSec: envNum("SUGGESTION_MERGE_GAP_SEC", 0.45),
    minSpacingSec: envNum("SUGGESTION_MIN_SPACING_SEC", 2.5),
    maxSpacingSec: Number.isFinite(maxSpacing) && maxSpacing! > 0 ? maxSpacing : null,
    minConfidence: envNum("SUGGESTION_MIN_CONFIDENCE", 0.42),
    maxSuggestions: Math.max(1, Math.floor(envNum("SUGGESTION_MAX_COUNT", 28))),
    weights: {
      scene: envNum("SUGGESTION_WEIGHT_SCENE", 0.35),
      audio: envNum("SUGGESTION_WEIGHT_AUDIO", 0.4),
      motion: envNum("SUGGESTION_WEIGHT_MOTION", 0.25),
    },
    sceneSampleFps,
  };
}
