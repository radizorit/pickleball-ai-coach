export type SignalKind = "scene" | "audio" | "motion";

export type SignalHit = {
  t: number;
  score: number;
  kind: SignalKind;
};

export type FusedSuggestion = {
  timestampSeconds: number;
  confidence: number;
  reason: string;
  audioPeak: number | null;
  motionScore: number | null;
  sceneScore: number | null;
  debug: {
    sceneScore?: number;
    audioPeak?: number;
    motionScore?: number;
    signalWeights: { scene: number; audio: number; motion: number };
    kind?: "contact" | "rally_start" | "rally_end";
    proposedRallyIndex?: number;
    endOfRallyLikely?: boolean;
  };
};

export type FuseStats = {
  rawCandidateCount: number;
  mergedClusterCount: number;
  /** Candidates that passed per-cluster confidence threshold (before max-gap filter). */
  afterConfidenceCount: number;
  /** Candidates after optional max-spacing gap filter (before min-spacing / max-count). */
  afterMaxGapCount: number;
  suppressedBelowThreshold: number;
  suppressedSpacing: number;
  suppressedMaxCount: number;
  outputCount: number;
  avgConfidence: number;
};
