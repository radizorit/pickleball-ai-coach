import { SHOT_OUTCOMES, SHOT_TYPES } from "../constants/index.js";
import type { ShotOutcome, ShotType } from "../constants/index.js";
import type { ShotEventDTO } from "../types/index.js";

/** Outcomes we treat as “mistakes” for headline stats (not `in`, `winner`, or `unknown`). */
const MISTAKE_OUTCOMES = ["out", "net", "forced_error", "unforced_error"] as const satisfies readonly ShotOutcome[];
type MistakeOutcome = (typeof MISTAKE_OUTCOMES)[number];

/** “Good” tags for simple success share on a shot type (rally still in or outright winner). */
const POSITIVE_OUTCOMES = ["in", "winner"] as const satisfies readonly ShotOutcome[];

function isMistakeOutcome(o: ShotOutcome): o is MistakeOutcome {
  return (MISTAKE_OUTCOMES as readonly string[]).includes(o);
}

function isPositiveOutcome(o: ShotOutcome): boolean {
  return (POSITIVE_OUTCOMES as readonly string[]).includes(o);
}

function isErrorOutcome(o: ShotOutcome): boolean {
  return isMistakeOutcome(o);
}

export interface VideoShotStats {
  totalShots: number;
  winners: number;
  unforcedErrors: number;
  /** Counts for mistake-class outcomes only. */
  errorsByOutcome: Record<MistakeOutcome, number>;
  /** Full counts for every known outcome enum. */
  outcomeTotals: Record<ShotOutcome, number>;
  /** Shot types with count > 0, sorted by count desc then `shotType` asc. */
  shotTypeBreakdown: { shotType: ShotType; count: number }[];
  /** From `side` on each event: forehand / backhand / other (`unknown` + `n_a`). */
  sideBreakdown: { forehand: number; backhand: number; other: number };
  /** Highest-frequency mistake outcome among tagged mistakes; null if no mistakes. */
  mostCommonMistake: MistakeOutcome | null;
  /** Highest good/total among shot types (min 1 tag); ties → more `good` tags, then name. */
  strongestShotType: ShotType | null;
  /** Highest bad/total among shot types with bad ≥ 1; ties → more `bad` tags, then name. */
  weakestShotType: ShotType | null;
}

function emptyOutcomeTotals(): Record<ShotOutcome, number> {
  const o: Partial<Record<ShotOutcome, number>> = {};
  for (const k of SHOT_OUTCOMES) {
    o[k] = 0;
  }
  return o as Record<ShotOutcome, number>;
}

function emptyMistakeCounts(): Record<MistakeOutcome, number> {
  return { out: 0, net: 0, forced_error: 0, unforced_error: 0 };
}

type Agg = { total: number; good: number; bad: number };

function pickExtreme(byType: Map<ShotType, Agg>, mode: "strongest" | "weakest"): ShotType | null {
  const types = [...SHOT_TYPES].sort((a, b) => a.localeCompare(b));
  type Cand = { t: ShotType; total: number; good: number; bad: number; rate: number };
  const cands: Cand[] = [];
  for (const t of types) {
    const { total, good, bad } = byType.get(t)!;
    if (total < 1) continue;
    const rate = mode === "strongest" ? good / total : bad / total;
    cands.push({ t, total, good, bad, rate });
  }
  if (cands.length === 0) return null;
  if (mode === "weakest" && cands.every((c) => c.bad < 1)) return null;

  cands.sort((a, b) => {
    if (mode === "strongest") {
      if (b.rate !== a.rate) return b.rate - a.rate;
      if (b.good !== a.good) return b.good - a.good;
      return a.t.localeCompare(b.t);
    }
    if (b.rate !== a.rate) return b.rate - a.rate;
    if (b.bad !== a.bad) return b.bad - a.bad;
    return a.t.localeCompare(b.t);
  });
  return cands[0]!.t;
}

/**
 * Deterministic aggregates over manual `shot_events` for one video.
 * Sorting uses ascending `shotType` / outcome id for stable ties.
 */
export function computeVideoShotStats(events: readonly ShotEventDTO[]): VideoShotStats {
  const outcomeTotals = emptyOutcomeTotals();
  const errorsByOutcome = emptyMistakeCounts();
  const shotTypeCounts = new Map<ShotType, number>();
  let winners = 0;
  let unforcedErrors = 0;
  let forehand = 0;
  let backhand = 0;
  let otherSide = 0;

  for (const t of SHOT_TYPES) {
    shotTypeCounts.set(t, 0);
  }

  for (const e of events) {
    outcomeTotals[e.outcome] = (outcomeTotals[e.outcome] ?? 0) + 1;
    if (e.outcome === "winner") winners += 1;
    if (e.outcome === "unforced_error") unforcedErrors += 1;
    if (isMistakeOutcome(e.outcome)) {
      errorsByOutcome[e.outcome] += 1;
    }

    shotTypeCounts.set(e.shotType, (shotTypeCounts.get(e.shotType) ?? 0) + 1);

    if (e.side === "forehand") forehand += 1;
    else if (e.side === "backhand") backhand += 1;
    else otherSide += 1;
  }

  const shotTypeBreakdown = [...shotTypeCounts.entries()]
    .filter(([, c]) => c > 0)
    .map(([shotType, count]) => ({ shotType, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.shotType.localeCompare(b.shotType);
    });

  let mostCommonMistake: MistakeOutcome | null = null;
  let bestMistakeCount = -1;
  const mistakeKeys = [...MISTAKE_OUTCOMES].sort((a, b) => a.localeCompare(b));
  for (const k of mistakeKeys) {
    const c = errorsByOutcome[k];
    if (c > bestMistakeCount) {
      bestMistakeCount = c;
      mostCommonMistake = k;
    }
  }
  if (bestMistakeCount <= 0) {
    mostCommonMistake = null;
  }

  const byType = new Map<ShotType, Agg>();
  for (const t of SHOT_TYPES) {
    byType.set(t, { total: 0, good: 0, bad: 0 });
  }
  for (const e of events) {
    const a = byType.get(e.shotType)!;
    a.total += 1;
    if (isPositiveOutcome(e.outcome)) a.good += 1;
    if (isErrorOutcome(e.outcome)) a.bad += 1;
  }

  const strongestShotType = pickExtreme(byType, "strongest");
  const weakestShotType = pickExtreme(byType, "weakest");

  return {
    totalShots: events.length,
    winners,
    unforcedErrors,
    errorsByOutcome,
    outcomeTotals,
    shotTypeBreakdown,
    sideBreakdown: { forehand, backhand, other: otherSide },
    mostCommonMistake,
    strongestShotType,
    weakestShotType,
  };
}
