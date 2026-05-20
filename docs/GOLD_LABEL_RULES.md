# Gold label rules (employee handbook)

Use this checklist for every **gold** reference video. Manual tags are the source of truth; timeline suggestions are navigation helpers only.

## Before you start (fresh session)

1. Open **Review** for the video.
2. Click **Clear all labels** if old test tags exist (removes shots, rallies, side switches; resets accepted/rejected suggestions to pending).
3. Read this page and follow the workflow below.

## Identity

- **`player_1` = Me** for the entire video, including after every end switch.
- **Never tag opponents** (no P2/P3/P4 on shot events).
- **Never swap Me to P2** when teams change ends — use **Switched ends** instead.

## What to tag (point-focused, Me only)

Tag **how the point ended** from your perspective. You do not need every ball you touch—focus on **point enders** and clear mistakes.

| Situation | Tag on **Me** (`player_1`) | Outcome | Timestamp | Ends rally |
|-----------|------------------------------|---------|-----------|------------|
| **I lose — out** | My shot that went out | `out` | Ball dead (out landing) | ✓ |
| **I lose — into net** | My shot into net | `net` | Ball dead (net) | ✓ |
| **I lose — they hit winner** | My last touch before their winner (if any) | `in` (or `forced_error` if you set them up) | Your contact, or when point is over | ✓ · note `lost: opp winner` |
| **I win — my winner** | My winning shot | `winner` | **Contact** | ✓ |
| **I win — they miss after my shot** | The shot **you** hit before their miss | `in` or `winner` | **Your contact** on that shot | ✓ · note `won: opp return out` |

Do **not** create a separate tag on an opponent slot when they miss—you record **your** forcing shot (or skip if you never touched the ball).

## Timestamps

| Event | Time to log |
|-------|-------------|
| My shot (`in`, `winner`) | **Paddle contact** |
| My mistake (`out`, `net`, UE, FE) | **Ball dead** — net or out landing |
| Side switch | **Switched ends** button (not a shot tag) |

Target **±0.25s** frame accuracy.

## Side switches (fixed camera)

Teams switch ends at least once per game. The camera does not move — **you** move on screen. Me stays `player_1`.

- Click **Switched ends** at the active clock when your team finishes changing ends.
- Amber ticks on the timeline mark each switch.
- Gold sessions should record **every** side switch.

## Rallies

1. Confirm **in-play windows** first (rally spans).
2. Tag point-relevant **Me** shots inside those windows.
3. Set **Ends rally** on the shot that closes the point.
4. Optionally set rally **winner** to Me when you won the point (including when they errored after your shot).

## Tagging workflow

1. **Clear all labels** (if redoing).
2. Mark all **side switches**.
3. Confirm or draw **rallies**.
4. Tag **only Me** for point outcomes per table above.
5. **Download training export** when complete.

## Quality bar (gold session)

- Full court visible; stable camera preferred.
- **≥10 Me tags** for full coaching feedback on the detail page.
- Prefer non-`unknown` shot type / side / outcome when possible.
- **All** side switches recorded.
- No opponent shot tags.

## Training export

`GET /v1/videos/:id/training-export` — schema v3 includes `sideSwitches`, rallies, shots, and suggestions.

```bash
npx tsx scripts/compare-suggestions.ts path/to/training-export.json
```

See also [SOLO_TAGGING.md](./SOLO_TAGGING.md).
