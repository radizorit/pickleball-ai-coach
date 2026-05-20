import type { VideoPlayerSlot } from "../constants/index.js";
import type { ShotEventDTO } from "../types/index.js";
import { computeVideoShotStats, type VideoShotStats } from "./video-shot-stats.js";

/** Events that count toward Me-only solo analysis (focus player tags only). */
export function filterSoloAnalysisEvents(
  events: readonly ShotEventDTO[],
  focusPlayerSlot: VideoPlayerSlot,
): ShotEventDTO[] {
  return events.filter((e) => e.playerSlot === focusPlayerSlot);
}

export interface SoloPlayerStats {
  focusPlayerSlot: VideoPlayerSlot;
  myShots: VideoShotStats;
}

export function computeSoloPlayerStats(
  events: readonly ShotEventDTO[],
  focusPlayerSlot: VideoPlayerSlot,
): SoloPlayerStats {
  const myEvents = filterSoloAnalysisEvents(events, focusPlayerSlot);
  return {
    focusPlayerSlot,
    myShots: computeVideoShotStats(myEvents),
  };
}
