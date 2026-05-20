"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useAuthedApiClient } from "@/lib/api/use-authed-api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SuggestedRallyDTO } from "@pickleball/shared";

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SuggestedRallyProposals({
  videoId,
  seekTo,
  onRallyAccepted,
}: {
  videoId: string;
  seekTo: (seconds: number) => void;
  onRallyAccepted?: (rallyId: string) => void;
}) {
  const client = useAuthedApiClient();
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ["videos", videoId, "suggested-rallies"],
    queryFn: () => client.videosSuggestedRalliesList(videoId),
  });

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["videos", videoId, "suggested-rallies"] });
    void qc.invalidateQueries({ queryKey: ["videos", videoId, "rallies"] });
  }, [qc, videoId]);

  const acceptMut = useMutation({
    mutationFn: (id: string) => client.videosSuggestedRallyAccept(videoId, id),
    onSuccess: (data) => {
      invalidate();
      onRallyAccepted?.(data.rally.id);
    },
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => client.videosSuggestedRallyReject(videoId, id),
    onSuccess: invalidate,
  });

  const pending = (listQ.data ?? []).filter((r) => r.status === "suggested");
  const accepted = (listQ.data ?? []).filter((r) => r.status === "accepted");

  if (listQ.isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Proposed rallies</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  if ((listQ.data ?? []).length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Proposed rallies</CardTitle>
        <CardDescription>
          Vision-detected rally spans (heuristic_v3). Confirm to create a rally, then accept contact
          suggestions inside it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {pending.length === 0 && accepted.length > 0 && (
          <p className="text-muted-foreground text-xs">All proposals reviewed ({accepted.length} accepted).</p>
        )}
        {pending.map((r: SuggestedRallyDTO) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-2 text-sm"
          >
            <button
              type="button"
              className="text-left hover:underline"
              onClick={() => seekTo(r.startTimeSeconds)}
            >
              {formatClock(r.startTimeSeconds)} – {formatClock(r.endTimeSeconds)}
              <span className="text-muted-foreground ml-2">
                {Math.round(r.confidence * 100)}%
              </span>
            </button>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={acceptMut.isPending}
                onClick={() => acceptMut.mutate(r.id)}
              >
                Accept
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={rejectMut.isPending}
                onClick={() => rejectMut.mutate(r.id)}
              >
                Reject
              </Button>
            </div>
          </div>
        ))}
        {(acceptMut.error || rejectMut.error) && (
          <p className="text-destructive text-xs">
            {(acceptMut.error as Error)?.message ?? (rejectMut.error as Error)?.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
