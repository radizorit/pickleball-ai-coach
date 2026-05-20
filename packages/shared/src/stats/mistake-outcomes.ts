import type { ShotOutcome } from "../constants/index.js";

/** Outcomes treated as mistakes for stats and solo opponent-error lens. */
export const MISTAKE_OUTCOMES = ["out", "net", "forced_error", "unforced_error"] as const satisfies readonly ShotOutcome[];
export type MistakeOutcome = (typeof MISTAKE_OUTCOMES)[number];

export function isMistakeOutcome(o: ShotOutcome): o is MistakeOutcome {
  return (MISTAKE_OUTCOMES as readonly string[]).includes(o);
}
