"use client";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthedApiClient } from "@/lib/api/use-authed-api-client";
import type { RallyConsistencyStatsDTO, VideoPlayerDTO } from "@pickleball/shared";
import type { VideoPlayerSlot } from "@pickleball/shared/constants";

function slotLabel(slot: VideoPlayerSlot, players: VideoPlayerDTO[]): string {
  const name = players.find((p) => p.slot === slot)?.displayName?.trim();
  if (name) return name;
  if (slot === "player_1") return "P1";
  if (slot === "player_2") return "P2";
  return slot;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function RallyConsistencyPanel({
  videoId,
  players,
  focusPlayerSlot,
}: {
  videoId: string;
  players: VideoPlayerDTO[] | undefined;
  focusPlayerSlot?: VideoPlayerSlot;
}) {
  const client = useAuthedApiClient();
  const q = useQuery({
    queryKey: ["videos", videoId, "rally-consistency"],
    queryFn: () => client.videosRallyConsistency(videoId),
    enabled: Boolean(videoId),
  });

  const stats: RallyConsistencyStatsDTO | undefined = q.data;
  const p = players ?? [];

  if (q.isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rally consistency</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted h-20 animate-pulse rounded-md" />
        </CardContent>
      </Card>
    );
  }

  const closed = stats?.closedRallyCount ?? 0;
  const hasData = closed > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Rally consistency</CardTitle>
        <CardDescription>
          {focusPlayerSlot
            ? "Point-level rally metrics (all closed rallies on this video)."
            : null}{" "}
          {hasData
            ? `${closed} closed rally${closed === 1 ? "" : "ies"} · ${stats?.openRallyCount ?? 0} open`
            : "Create rallies and close them (or mark “ends rally” on a shot) to see metrics."}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs font-medium uppercase tracking-wide">Avg rally length</p>
            <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
              {stats?.averageRallyLength != null ? stats.averageRallyLength.toFixed(1) : "—"}
            </p>
            <p className="text-xs">Shots per closed rally</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs font-medium uppercase tracking-wide">Longest rally</p>
            <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
              {stats?.longestRallyLength ?? "—"}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs font-medium uppercase tracking-wide">Shots before error (avg)</p>
            <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
              {avg(stats?.shotsBeforeError ?? [])?.toFixed(1) ?? "—"}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs font-medium uppercase tracking-wide">Shots before winner (avg)</p>
            <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
              {avg(stats?.shotsBeforeWinner ?? [])?.toFixed(1) ?? "—"}
            </p>
          </div>
        </div>

        {hasData && stats && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Rallies won
              </p>
              <ul className="space-y-1">
                {(["player_1", "player_2"] as const).map((slot) => (
                  <li key={slot} className="flex justify-between gap-4 tabular-nums">
                    <span>{slotLabel(slot, p)}</span>
                    <span className="text-foreground">{stats.playerWinnerCounts[slot]}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Errors (ending shot)
              </p>
              <ul className="space-y-1">
                {(["player_1", "player_2"] as const).map((slot) => (
                  <li key={slot} className="flex justify-between gap-4 tabular-nums">
                    <span>{slotLabel(slot, p)}</span>
                    <span className="text-foreground">{stats.playerErrorCounts[slot]}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
