export interface SideSwitchSegment {
  /** Segment start in seconds (0 for first segment). */
  start: number;
  /** Segment end in seconds (video duration for last segment). */
  end: number;
  /** 0-based segment index after each side switch. */
  segmentIndex: number;
}

export interface SideSwitchPoint {
  timestampSeconds: number;
  segmentIndex: number | null;
}

/**
 * Split video duration into segments bounded by side-switch timestamps.
 * Switches mark the start of a new segment at `timestampSeconds`.
 */
export function getSideSwitchSegments(
  switches: readonly SideSwitchPoint[],
  durationSeconds: number,
): SideSwitchSegment[] {
  const sorted = [...switches].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  const duration = Math.max(durationSeconds, 0);

  if (sorted.length === 0) {
    return [{ start: 0, end: duration, segmentIndex: 0 }];
  }

  const segments: SideSwitchSegment[] = [];
  let start = 0;
  let segmentIndex = 0;

  for (let i = 0; i < sorted.length; i++) {
    const sw = sorted[i]!;
    const switchAt = Math.max(0, Math.min(sw.timestampSeconds, duration));
    if (switchAt > start) {
      segments.push({ start, end: switchAt, segmentIndex });
    }
    start = switchAt;
    segmentIndex = sw.segmentIndex ?? i + 1;
  }

  if (start < duration || segments.length === 0) {
    segments.push({ start, end: duration, segmentIndex });
  }

  return segments;
}
