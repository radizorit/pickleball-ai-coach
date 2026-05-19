"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ShotEventDTO } from "@pickleball/shared";
import { computeVideoShotStats, type VideoShotStats } from "@pickleball/shared";

function pct(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  return `${Math.round((part / whole) * 1000) / 10}%`;
}

function labelMistake(o: NonNullable<VideoShotStats["mostCommonMistake"]>): string {
  switch (o) {
    case "forced_error":
      return "forced error";
    case "unforced_error":
      return "unforced error";
    default:
      return o;
  }
}

export function VideoShotStatsPanel({
  videoId,
  events,
  isLoading,
  showReviewLink = false,
}: {
  videoId: string;
  events: ShotEventDTO[] | undefined;
  isLoading: boolean;
  /** When on the detail page, link to the review studio for tagging. */
  showReviewLink?: boolean;
}) {
  const stats = useMemo(() => computeVideoShotStats(events ?? []), [events]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Shot stats</CardTitle>
          <CardDescription>Loading tags…</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted h-24 animate-pulse rounded-md" />
        </CardContent>
      </Card>
    );
  }

  const { totalShots, sideBreakdown } = stats;
  const sideTotal = sideBreakdown.forehand + sideBreakdown.backhand + sideBreakdown.other;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Shot stats</CardTitle>
            <CardDescription>
              From manual tags only ·{" "}
              {totalShots === 0 ? "Add shots in review to see stats." : `${totalShots} tagged`}
            </CardDescription>
          </div>
          {showReviewLink && (
            <Link
              href={`/videos/${videoId}/review`}
              className="text-primary text-sm font-medium underline underline-offset-4"
            >
              Tag in review →
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-muted-foreground space-y-6 text-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Total shots</p>
            <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">{stats.totalShots}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Winners</p>
            <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">{stats.winners}</p>
            <p className="text-xs">{pct(stats.winners, totalShots)} of tags</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Unforced errors</p>
            <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">{stats.unforcedErrors}</p>
            <p className="text-xs">{pct(stats.unforcedErrors, totalShots)} of tags</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Most common mistake</p>
            <p className="text-foreground mt-1 text-lg font-semibold capitalize">
              {stats.mostCommonMistake ? labelMistake(stats.mostCommonMistake) : "—"}
            </p>
            {stats.mostCommonMistake && (
              <p className="text-xs">
                {stats.errorsByOutcome[stats.mostCommonMistake]}× (
                {pct(stats.errorsByOutcome[stats.mostCommonMistake], totalShots)} of tags)
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-foreground mb-2 text-xs font-medium uppercase tracking-wide">Errors by outcome</p>
            <ul className="space-y-1">
              {(
                [
                  ["out", stats.errorsByOutcome.out],
                  ["net", stats.errorsByOutcome.net],
                  ["forced_error", stats.errorsByOutcome.forced_error],
                  ["unforced_error", stats.errorsByOutcome.unforced_error],
                ] as const
              ).map(([k, n]) => (
                <li key={k} className="flex justify-between gap-4 tabular-nums">
                  <span className="capitalize">{labelMistake(k)}</span>
                  <span>
                    {n}
                    <span className="text-muted-foreground/80 ml-1 text-xs">({pct(n, totalShots)})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Forehand vs backhand (side)
            </p>
            <ul className="space-y-1">
              <li className="flex justify-between gap-4 tabular-nums">
                <span>Forehand</span>
                <span>
                  {sideBreakdown.forehand}
                  <span className="text-muted-foreground/80 ml-1 text-xs">
                    ({pct(sideBreakdown.forehand, sideTotal)})
                  </span>
                </span>
              </li>
              <li className="flex justify-between gap-4 tabular-nums">
                <span>Backhand</span>
                <span>
                  {sideBreakdown.backhand}
                  <span className="text-muted-foreground/80 ml-1 text-xs">
                    ({pct(sideBreakdown.backhand, sideTotal)})
                  </span>
                </span>
              </li>
              <li className="flex justify-between gap-4 tabular-nums">
                <span>Other / unknown</span>
                <span>
                  {sideBreakdown.other}
                  <span className="text-muted-foreground/80 ml-1 text-xs">
                    ({pct(sideBreakdown.other, sideTotal)})
                  </span>
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-foreground mb-2 text-xs font-medium uppercase tracking-wide">Strongest shot (by tag)</p>
            <p className="text-foreground text-lg font-semibold">{stats.strongestShotType ?? "—"}</p>
            <p className="text-xs">Highest share of good outcomes (`in` + `winner`) per shot type.</p>
          </div>
          <div>
            <p className="text-foreground mb-2 text-xs font-medium uppercase tracking-wide">Weakest shot (by tag)</p>
            <p className="text-foreground text-lg font-semibold">{stats.weakestShotType ?? "—"}</p>
            <p className="text-xs">
              Highest share of mistake outcomes per shot type (needs ≥1 mistake on that type).
            </p>
          </div>
        </div>

        <div>
          <p className="text-foreground mb-2 text-xs font-medium uppercase tracking-wide">Shot type breakdown</p>
          {stats.shotTypeBreakdown.length === 0 ? (
            <p className="text-xs">No shot types yet.</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {stats.shotTypeBreakdown.map(({ shotType, count }) => (
                <li key={shotType} className="flex justify-between gap-4 tabular-nums">
                  <span className="text-foreground">{shotType}</span>
                  <span>
                    {count}
                    <span className="text-muted-foreground/80 ml-1 text-xs">({pct(count, totalShots)})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
