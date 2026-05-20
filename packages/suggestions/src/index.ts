export {
  loadSuggestionHeuristicConfig,
  type CourtCornersNormalized,
  type SuggestionHeuristicConfig,
  type SuggestionMediaEnv,
} from "./config.js";
export { fuseContactsPerRally } from "./contact-peaks.js";
export { fuseSignalHits, clusterSignalHits, applyMinSpacing } from "./fuse.js";
export { runSuggestionPipeline, type SuggestionPipelineResult } from "./pipeline.js";
export { runSuggestionPipelineV3 } from "./pipeline-v3.js";
export { proposeRallySegments } from "./rally-segments.js";
export { detectVisualEnergyCurve } from "./signals/visual-energy.js";
export type { FuseStats, FusedSuggestion, SignalHit, SignalKind } from "./types.js";
