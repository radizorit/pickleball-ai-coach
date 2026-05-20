import type { VideoPlayerSlot } from "../constants/index.js";
import type { ShotOutcome } from "../constants/index.js";
import type { RallyConsistencyStatsDTO, ShotEventDTO } from "../types/index.js";
import { isMistakeOutcome } from "./mistake-outcomes.js";
import { computeVideoShotStats } from "./video-shot-stats.js";

/** Minimum tagged shots before we show full coaching conclusions. */
export const COACHING_MIN_TAGS_FOR_FULL_FEEDBACK = 10;

/** Minimum closed rallies before rally consistency is woven into copy. */
export const COACHING_MIN_CLOSED_RALLIES = 3;

export interface CoachingFeedbackReport {
  /** Fewer than {@link COACHING_MIN_TAGS_FOR_FULL_FEEDBACK} tags — softer copy and generic drills. */
  lowSample: boolean;
  tagCount: number;
  overallSummary: string;
  biggestWeakness: string;
  biggestStrength: string;
  mostCommonMistakeLine: string;
  recommendedDrills: string[];
  suggestedNextFocus: string;
}

function mistakeLabel(
  o: Extract<ShotOutcome, "forced_error" | "unforced_error"> | "out" | "net",
): string {
  switch (o) {
    case "forced_error":
      return "forced errors";
    case "unforced_error":
      return "unforced errors";
    default:
      return o;
  }
}

function aggregateMistakeContext(events: readonly ShotEventDTO[]) {
  let fhMistakes = 0;
  let bhMistakes = 0;
  let otherSideMistakes = 0;
  let serveReturnMistakes = 0;
  let dinkVolleyMistakes = 0;
  let mistakeCount = 0;

  for (const e of events) {
    if (!isMistakeOutcome(e.outcome)) continue;
    mistakeCount += 1;
    if (e.side === "forehand") fhMistakes += 1;
    else if (e.side === "backhand") bhMistakes += 1;
    else otherSideMistakes += 1;
    if (e.shotType === "serve" || e.shotType === "return") serveReturnMistakes += 1;
    if (e.shotType === "dink" || e.shotType === "volley") dinkVolleyMistakes += 1;
  }

  return { fhMistakes, bhMistakes, otherSideMistakes, serveReturnMistakes, dinkVolleyMistakes, mistakeCount };
}

function ratio(num: number, den: number): number {
  if (den <= 0) return 0;
  return num / den;
}

/**
 * Deterministic, rule-based coaching copy from manual tags + {@link computeVideoShotStats}.
 * No network, no AI — same inputs always yield the same report.
 */
export function computeCoachingFeedback(
  events: readonly ShotEventDTO[],
  options?: { rallyStats?: RallyConsistencyStatsDTO; focusPlayerSlot?: VideoPlayerSlot },
): CoachingFeedbackReport {
  const focus = options?.focusPlayerSlot;
  const myEvents =
    focus != null ? events.filter((e) => e.playerSlot === focus) : events;

  const tagCount = myEvents.length;
  const lowSample = tagCount < COACHING_MIN_TAGS_FOR_FULL_FEEDBACK;
  const stats = computeVideoShotStats(myEvents);
  const ctx = aggregateMistakeContext(myEvents);

  const total = stats.totalShots;
  const winners = stats.winners;
  const unforced = stats.unforcedErrors;
  const mistakeTotal = ctx.mistakeCount;

  const unforcedHigh = total > 0 && (unforced >= 3 || ratio(unforced, total) >= 0.2);
  const bhVsFh = ctx.bhMistakes > ctx.fhMistakes && ctx.bhMistakes >= 1;
  const fhVsBh = ctx.fhMistakes > ctx.bhMistakes && ctx.fhMistakes >= 1;
  const serveReturnHigh =
    mistakeTotal > 0 &&
    ctx.serveReturnMistakes >= 2 &&
    ratio(ctx.serveReturnMistakes, mistakeTotal) >= 0.35;
  const dinkVolleyHigh =
    mistakeTotal > 0 &&
    ctx.dinkVolleyMistakes >= 2 &&
    ratio(ctx.dinkVolleyMistakes, mistakeTotal) >= 0.35;
  const controlledAggression =
    total > 0 && ratio(winners, total) >= 0.25 && mistakeTotal > 0 && ratio(mistakeTotal, total) >= 0.25;

  const drills = new Set<string>();
  if (unforcedHigh) {
    drills.add("Consistency blocks: aim for 20-ball rallies with margin over the net (no winners).");
  }
  if (bhVsFh) {
    drills.add("Backhand: cross-court dinks + defensive blocks from mid-court feeds.");
  }
  if (fhVsBh && !bhVsFh) {
    drills.add("Forehand: approach-step timing on drives and controlled topspin targets.");
  }
  if (serveReturnHigh) {
    drills.add("Serve + return: deep targets (baseline cones) and second-ball neutral patterns.");
  }
  if (dinkVolleyHigh) {
    drills.add("Kitchen: line dink battles, volley resets, and NVZ footwork ladders.");
  }
  if (controlledAggression) {
    drills.add("Controlled aggression: pick 70% pace targets before adding speed.");
  }
  if (drills.size === 0) {
    drills.add("Balanced tagging: add more variety (serve, return, kitchen) to surface priorities.");
  }

  const recommendedDrills = [...drills].sort((a, b) => a.localeCompare(b));

  const mostCommonMistakeLine =
    stats.mostCommonMistake != null
      ? `Most recorded mistake outcome: ${mistakeLabel(stats.mostCommonMistake)} (${stats.errorsByOutcome[stats.mostCommonMistake]}×).`
      : "No clear mistake outcome pattern yet — keep tagging errors when you see them.";

  let biggestWeakness: string;
  if (lowSample) {
    biggestWeakness =
      "Not enough tags to rank a dominant weakness — aim for at least 10 shots across different situations.";
  } else if (stats.weakestShotType) {
    biggestWeakness = `Shot type “${stats.weakestShotType}” carries the highest mistake share in your tags.`;
  } else if (bhVsFh) {
    biggestWeakness =
      "Backhand-side tags include more mistakes than forehand — prioritize BH contact and spacing.";
  } else if (fhVsBh) {
    biggestWeakness =
      "Forehand-side tags include more mistakes than backhand — check overextension and target selection.";
  } else if (serveReturnHigh) {
    biggestWeakness = "Serves and returns account for a large share of mistakes — work depth and safety.";
  } else if (dinkVolleyHigh) {
    biggestWeakness = "Kitchen shots (dinks/volleys) cluster in your mistake mix — tighten NVZ control.";
  } else {
    biggestWeakness =
      "No single dominant weakness from these tags yet — keep logging serves, returns, and kitchen exchanges.";
  }

  let biggestStrength: string;
  if (lowSample) {
    biggestStrength =
      "Strengths become clearer after more tags — early winners and clean rallies still count.";
  } else if (stats.strongestShotType) {
    biggestStrength = `Shot type “${stats.strongestShotType}” shows the best good-outcome share (in + winner) in your data.`;
  } else if (ratio(winners, total) >= 0.2) {
    biggestStrength = "You convert a healthy share of tags into winners — keep choosing high-percentage finishes.";
  } else {
    biggestStrength =
      "Patterns are still emerging — continue tagging positive outcomes (in / winner) on your best swings.";
  }

  const rallyStats = options?.rallyStats;
  const closedRallies = rallyStats?.closedRallyCount ?? 0;
  const rallyLine =
    closedRallies >= COACHING_MIN_CLOSED_RALLIES && rallyStats?.averageRallyLength != null
      ? ` Closed rallies average ${rallyStats.averageRallyLength.toFixed(1)} shots (longest ${rallyStats.longestRallyLength ?? "—"}).`
      : "";

  let overallSummary: string;
  if (lowSample) {
    overallSummary = `You have ${tagCount} tag${tagCount === 1 ? "" : "s"} on your shots. Add at least ${COACHING_MIN_TAGS_FOR_FULL_FEEDBACK} for stronger, rule-based feedback. Below is a light preview from what you logged so far.${rallyLine}`;
  } else {
    overallSummary = `From ${total} of your Me tags: ${winners} winner${winners === 1 ? "" : "s"}, ${mistakeTotal} mistake-class outcome${mistakeTotal === 1 ? "" : "s"}, ${unforced} unforced error${unforced === 1 ? "" : "s"}. Rule-based feedback from your shots only.${rallyLine}`;
  }

  let suggestedNextFocus: string;
  if (lowSample) {
    suggestedNextFocus = "Add more tags in Review (mix serve, return, dink, volley, and both sides).";
  } else if (unforcedHigh) {
    suggestedNextFocus = "Next focus: reduce unforced errors with margin and repetition before adding risk.";
  } else if (bhVsFh) {
    suggestedNextFocus = "Next focus: backhand stability under pressure (depth and block shape).";
  } else if (serveReturnHigh) {
    suggestedNextFocus = "Next focus: first two balls — depth on serve and neutral returns.";
  } else if (dinkVolleyHigh) {
    suggestedNextFocus = "Next focus: kitchen patience and volley height over speed.";
  } else if (stats.weakestShotType) {
    suggestedNextFocus = `Next focus: simplify and repeat “${stats.weakestShotType}” patterns until mistakes drop.`;
  } else if (controlledAggression) {
    suggestedNextFocus = "Next focus: keep attacking intent but pick safer targets when ahead in the rally.";
  } else {
    suggestedNextFocus = "Next focus: keep tagging consistently so trends (serve vs kitchen) stand out.";
  }

  return {
    lowSample,
    tagCount,
    overallSummary,
    biggestWeakness,
    biggestStrength,
    mostCommonMistakeLine,
    recommendedDrills,
    suggestedNextFocus,
  };
}
