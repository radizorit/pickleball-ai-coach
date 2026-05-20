import { describe, expect, it } from "vitest";

import type { ShotEventDTO } from "../types/index.js";
import { computeSoloPlayerStats, filterSoloAnalysisEvents } from "./solo-analysis.js";

function shot(partial: Partial<ShotEventDTO> & Pick<ShotEventDTO, "playerSlot" | "outcome">): ShotEventDTO {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    videoId: "00000000-0000-4000-8000-000000000002",
    rallyId: null,
    playerSlot: partial.playerSlot,
    shotIndexInRally: null,
    endsRally: false,
    timestampSeconds: partial.timestampSeconds ?? 1,
    shotType: partial.shotType ?? "forehand",
    side: partial.side ?? "forehand",
    outcome: partial.outcome,
    note: null,
    source: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("filterSoloAnalysisEvents", () => {
  const focus = "player_1" as const;
  const events = [
    shot({ playerSlot: "player_1", outcome: "winner" }),
    shot({ playerSlot: "player_1", outcome: "unforced_error" }),
    shot({ playerSlot: "player_2", outcome: "unforced_error" }),
    shot({ playerSlot: "player_2", outcome: "out" }),
    shot({ playerSlot: null, outcome: "net" }),
  ];

  it("includes only focus player shots", () => {
    const filtered = filterSoloAnalysisEvents(events, focus);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.playerSlot === focus)).toBe(true);
  });

  it("excludes opponent and untagged shots", () => {
    const filtered = filterSoloAnalysisEvents(events, focus);
    expect(filtered.some((e) => e.playerSlot === "player_2")).toBe(false);
    expect(filtered.some((e) => e.playerSlot == null)).toBe(false);
  });
});

describe("computeSoloPlayerStats", () => {
  it("counts my shots only", () => {
    const stats = computeSoloPlayerStats(
      [
        shot({ playerSlot: "player_1", outcome: "winner" }),
        shot({ playerSlot: "player_1", outcome: "unforced_error" }),
        shot({ playerSlot: "player_2", outcome: "unforced_error" }),
      ],
      "player_1",
    );
    expect(stats.myShots.totalShots).toBe(2);
    expect(stats.myShots.winners).toBe(1);
    expect(stats.myShots.unforcedErrors).toBe(1);
  });
});
