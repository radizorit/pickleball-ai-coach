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
  };
};

export type FuseStats = {
  rawCandidateCount: number;
  mergedClusterCount: number;
  suppressedBelowThreshold: number;
  suppressedSpacing: number;
  suppressedMaxCount: number;
  outputCount: number;
  avgConfidence: number;
};
