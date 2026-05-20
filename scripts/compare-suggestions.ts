/**
 * Stub: compare manual shot timestamps vs suggested_shot_events in a training export JSON.
 * Usage: npx tsx scripts/compare-suggestions.ts path/to/export.json
 */
import { readFileSync } from "node:fs";

const WINDOW_SEC = 0.5;

type ExportRow = {
  suggestionId: string;
  suggestionTimestampSeconds: number;
  suggestionStatus: string;
  becameConfirmedShot: boolean;
};

type ExportShot = {
  shotEventId: string;
  timestampSeconds: number;
  playerSlot?: string | null;
};

type Export = {
  rows: ExportRow[];
  shots?: ExportShot[];
};

function main(): void {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npx tsx scripts/compare-suggestions.ts <training-export.json>");
    process.exit(1);
  }

  const raw = readFileSync(path, "utf8");
  const data = JSON.parse(raw) as Export;
  const manual = (data.shots ?? []).filter((s) => s.playerSlot === "player_1" || s.playerSlot == null);
  const suggestions = data.rows.filter((r) => r.suggestionStatus === "suggested" || r.suggestionStatus === "accepted");

  let matched = 0;
  const used = new Set<string>();

  for (const shot of manual) {
    let bestId: string | null = null;
    let bestDt = Infinity;
    for (const s of suggestions) {
      const dt = Math.abs(s.suggestionTimestampSeconds - shot.timestampSeconds);
      if (dt <= WINDOW_SEC && dt < bestDt) {
        bestDt = dt;
        bestId = s.suggestionId;
      }
    }
    if (bestId) {
      matched += 1;
      used.add(bestId);
    }
  }

  const falsePos = suggestions.length - used.size;
  const falseNeg = manual.length - matched;
  const precision = matched + falsePos > 0 ? matched / (matched + falsePos) : 0;
  const recall = manual.length > 0 ? matched / manual.length : 0;

  console.log(`Manual shots: ${manual.length}`);
  console.log(`Suggestions (pending+accepted in export): ${suggestions.length}`);
  console.log(`Matched within ±${WINDOW_SEC}s: ${matched}`);
  console.log(`False positives (suggestions): ${falsePos}`);
  console.log(`False negatives (manual): ${falseNeg}`);
  console.log(`Precision (approx): ${(precision * 100).toFixed(1)}%`);
  console.log(`Recall (approx): ${(recall * 100).toFixed(1)}%`);
}

main();
