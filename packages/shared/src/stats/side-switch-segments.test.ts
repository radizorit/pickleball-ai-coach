import { describe, expect, it } from "vitest";

import { getSideSwitchSegments } from "./side-switch-segments.js";

describe("getSideSwitchSegments", () => {
  it("returns single segment when no switches", () => {
    expect(getSideSwitchSegments([], 120)).toEqual([{ start: 0, end: 120, segmentIndex: 0 }]);
  });

  it("splits at switch timestamps", () => {
    const segments = getSideSwitchSegments(
      [
        { timestampSeconds: 30, segmentIndex: 1 },
        { timestampSeconds: 90, segmentIndex: 2 },
      ],
      120,
    );
    expect(segments).toEqual([
      { start: 0, end: 30, segmentIndex: 0 },
      { start: 30, end: 90, segmentIndex: 1 },
      { start: 90, end: 120, segmentIndex: 2 },
    ]);
  });
});
