# Me-only tagging and gold-label workflow

PickleballAssistant targets **solo player analysis** on recreational doubles footage: four people on court, one subject (you). Manual tags are the **source of truth**; timeline suggestions are assist-only helpers.

**Handbook:** [GOLD_LABEL_RULES.md](./GOLD_LABEL_RULES.md) — timestamps, Me identity, side switches, quality bar.

## Me = player_1

- Convention: **`player_1` = Me** for the full video, including after every end switch.
- `focusPlayerSlot` on the video defaults to `player_1` (API field retained; Review tags Me only).

## Start fresh on a video

In Review, **Clear all labels** (`POST /v1/videos/:id/reset-labels`) removes all shots, rallies, and side switches on that video and resets accepted/rejected suggestions to pending. Use this before a gold-label pass so test CRUD data does not pollute the export.
- Display name for P1 defaults to **Me** when players are first loaded.

## Timestamp rubric

| What | Timestamp |
|------|-----------|
| **My shot** (in, winner, neutral) | Paddle **contact** |
| **My mistake** (out, net, UE, FE) | **Ball dead** — net touch or out landing |
| **Side switch** | Click **Switched ends** at active clock when your team finishes changing ends |

Do **not** tag opponents. Do **not** move Me to P2 when teams switch ends.

## Tagging workflow

1. Open **Review**.
2. Mark **every side switch** with **Switched ends** (amber timeline ticks).
3. Confirm or draw **rallies** (in-play windows).
4. Tag **Me only** with shot type, side, and outcome; use **Ends rally** when the point closes.
5. Optional: run the **review queue** to accept/reject suggestions — converts always attach **Me** (`player_1`).

## Stats and coaching

- **Shot stats** and **coaching feedback** use **Me tags only** (`playerSlot === player_1`).
- Untagged shots (`playerSlot: null`) are excluded.
- **Rally consistency** stays point-level (all closed rallies).

## Side switches

Stored in `video_side_switches` and included in training export v3 as `sideSwitches[]` for future ROI / per-segment ML.

Helper (shared): `getSideSwitchSegments(switches, durationSeconds)` → `{ start, end, segmentIndex }[]`.

## Gold labels and training export

1. Complete a gold session per [GOLD_LABEL_RULES.md](./GOLD_LABEL_RULES.md).
2. **Download training export** on Review (`GET /v1/videos/:id/training-export`, schema **v3**).

### Comparing heuristics (optional)

For each manual Me shot in `shots[]`, find the nearest suggestion within **±0.5s**:

```bash
npx tsx scripts/compare-suggestions.ts path/to/training-export.json
```

## Out of scope

- Opponent tagging
- Auto who-hit / winner detection from video
- ffmpeg / suggestion pipeline tuning in this workflow
