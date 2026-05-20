import { DEFAULT_VIDEO_PLAYER_SLOTS, VIDEO_PLAYER_SLOTS } from "../constants/index.js";
import type { RallyEndReason, ShotOutcome, VideoPlayerSlot } from "../constants/index.js";
import type {
  RallyConsistencyStatsDTO,
  ShotEventDTO,
  VideoPlayerDTO,
  VideoRallyDTO,
} from "../types/index.js";

const MISTAKE_OUTCOMES = ["out", "net", "forced_error", "unforced_error"] as const satisfies readonly ShotOutcome[];

function isMistakeOutcome(o: ShotOutcome): boolean {
  return (MISTAKE_OUTCOMES as readonly string[]).includes(o);
}

function emptySlotCounts(): Record<VideoPlayerSlot, number> {
  const counts = {} as Record<VideoPlayerSlot, number>;
  for (const slot of VIDEO_PLAYER_SLOTS) {
    counts[slot] = 0;
  }
  return counts;
}

function isClosedRally(r: VideoRallyDTO): boolean {
  return r.endTimeSeconds != null;
}

/**
 * Deterministic rally consistency metrics from manual tags.
 * Closed rallies only contribute to averages and shots-before-* arrays.
 */
export function computeRallyConsistencyStats(params: {
  rallies: readonly VideoRallyDTO[];
  shots: readonly ShotEventDTO[];
  players?: readonly VideoPlayerDTO[];
}): RallyConsistencyStatsDTO {
  const { rallies, shots } = params;
  const closed = rallies.filter(isClosedRally);
  const openRallyCount = rallies.length - closed.length;

  const shotsByRally = new Map<string, ShotEventDTO[]>();
  for (const s of shots) {
    if (!s.rallyId) continue;
    const list = shotsByRally.get(s.rallyId) ?? [];
    list.push(s);
    shotsByRally.set(s.rallyId, list);
  }

  const lengths = closed.map((r) => {
    const list = shotsByRally.get(r.id) ?? [];
    return list.length > 0 ? list.length : r.shotCount;
  });

  const averageRallyLength =
    lengths.length > 0
      ? Math.round((lengths.reduce((a, b) => a + b, 0) / lengths.length) * 10) / 10
      : null;
  const longestRallyLength = lengths.length > 0 ? Math.max(...lengths) : null;

  const shotsBeforeError: number[] = [];
  const shotsBeforeWinner: number[] = [];
  const playerWinnerCounts = emptySlotCounts();
  const playerErrorCounts = emptySlotCounts();

  for (const r of closed) {
    const len = shotsByRally.get(r.id)?.length ?? r.shotCount;
    if (r.endReason === "error") {
      shotsBeforeError.push(len);
    }
    if (r.endReason === "winner") {
      shotsBeforeWinner.push(len);
    }
    if (r.winningPlayerSlot) {
      playerWinnerCounts[r.winningPlayerSlot] += 1;
    }

    if (r.endReason === "error") {
      const ending = shots.find((s) => s.rallyId === r.id && s.endsRally);
      if (ending?.playerSlot) {
        playerErrorCounts[ending.playerSlot] += 1;
      }
    }
  }

  return {
    closedRallyCount: closed.length,
    openRallyCount,
    averageRallyLength,
    longestRallyLength,
    shotsBeforeError,
    shotsBeforeWinner,
    playerWinnerCounts,
    playerErrorCounts,
  };
}

/** Derive rally end metadata from the ending shot (API mirrors this on write). */
export function deriveRallyEndFromShot(shot: {
  outcome: ShotOutcome;
  playerSlot: VideoPlayerSlot | null;
}): { endReason: RallyEndReason; winningPlayerSlot: VideoPlayerSlot | null } {
  let endReason: RallyEndReason = "unknown";
  let winningPlayerSlot: VideoPlayerSlot | null = null;

  if (shot.outcome === "winner") {
    endReason = "winner";
    winningPlayerSlot = shot.playerSlot;
  } else if (isMistakeOutcome(shot.outcome)) {
    endReason = "error";
    if (shot.playerSlot === "player_1") {
      winningPlayerSlot = "player_2";
    } else if (shot.playerSlot === "player_2") {
      winningPlayerSlot = "player_1";
    }
  }

  return { endReason, winningPlayerSlot };
}

export const SINGLES_PLAYER_SLOTS = DEFAULT_VIDEO_PLAYER_SLOTS;
