"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useAuthedApiClient } from "@/lib/api/use-authed-api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { VideoCourtCorners, VideoDTO } from "@pickleball/shared";

/** Default center-court ROI (normalized 0–1): near-left, near-right, far-right, far-left. */
const PRESET_CENTER_COURT: VideoCourtCorners = [
  { x: 0.2, y: 0.35 },
  { x: 0.8, y: 0.35 },
  { x: 0.8, y: 0.9 },
  { x: 0.2, y: 0.9 },
];

export function CourtCornersPanel({ video }: { video: VideoDTO }) {
  const client = useAuthedApiClient();
  const qc = useQueryClient();
  const [corners, setCorners] = useState<VideoCourtCorners | null>(video.courtCorners);

  const saveMut = useMutation({
    mutationFn: (next: VideoCourtCorners | null) =>
      client.videosCourtCornersUpsert(video.id, { courtCorners: next }),
    onSuccess: (updated) => {
      setCorners(updated.courtCorners);
      void qc.invalidateQueries({ queryKey: ["videos", video.id] });
    },
  });

  if (video.youtubeUrl) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Court ROI</CardTitle>
        <CardDescription>
          Optional quad (normalized 0–1) masks motion for suggestions. Regenerate after saving.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saveMut.isPending}
            onClick={() => {
              setCorners(PRESET_CENTER_COURT);
              saveMut.mutate(PRESET_CENTER_COURT);
            }}
          >
            Use center court preset
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={saveMut.isPending || !corners}
            onClick={() => {
              setCorners(null);
              saveMut.mutate(null);
            }}
          >
            Clear
          </Button>
        </div>
        {corners && (
          <p className="text-muted-foreground text-xs">
            Active: ({corners[0].x.toFixed(2)}, {corners[0].y.toFixed(2)}) … (
            {corners[2].x.toFixed(2)}, {corners[2].y.toFixed(2)})
          </p>
        )}
        {saveMut.error && (
          <p className="text-destructive text-xs">{(saveMut.error as Error).message}</p>
        )}
      </CardContent>
    </Card>
  );
}
