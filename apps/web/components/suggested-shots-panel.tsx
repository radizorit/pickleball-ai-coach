"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiClientError } from "@/lib/api/client";
import { useAuthedApiClient } from "@/lib/api/use-authed-api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SuggestedShotEventDTO, SuggestedShotRegenerateSummaryDTO, VideoDTO } from "@pickleball/shared";
import type { VideoPlayerSlot } from "@pickleball/shared/constants";
import type { ConvertSuggestedShotBody } from "@pickleball/shared/zod";

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type ListFilter = "pending" | "high" | "all";

function rowClass(status: SuggestedShotEventDTO["status"], focused: boolean): string {
  const base = "rounded-md border p-2 transition-colors ";
  if (status === "accepted") {
    return `${base} border-emerald-500/50 bg-emerald-500/10 ${focused ? "ring-2 ring-emerald-500" : ""}`;
  }
  if (status === "rejected") {
    return `${base} border-muted-foreground/30 bg-muted/30 opacity-60 line-through ${focused ? "ring-2 ring-muted-foreground" : ""}`;
  }
  return `${base} border-dashed hover:bg-muted/50 ${focused ? "ring-2 ring-primary" : ""}`;
}

export function SuggestedShotsPanel({
  videoId,
  processingStatus,
  seekTo,
  onFocusChange,
  disableShortcuts = false,
  activeRallyId = null,
  playerSlot = null,
}: {
  videoId: string;
  processingStatus: VideoDTO["processingStatus"];
  seekTo: (seconds: number) => void;
  onFocusChange?: (suggestion: SuggestedShotEventDTO | null) => void;
  /** When true (e.g. review queue active), list shortcuts are disabled. */
  disableShortcuts?: boolean;
  activeRallyId?: string | null;
  playerSlot?: VideoPlayerSlot | null;
}) {
  const client = useAuthedApiClient();
  const qc = useQueryClient();

  const [confidenceThreshold, setConfidenceThreshold] = useState(0.55);
  const [listFilter, setListFilter] = useState<ListFilter>("pending");
  const [debugMode, setDebugMode] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [regenerateSummary, setRegenerateSummary] = useState<SuggestedShotRegenerateSummaryDTO | null>(
    null,
  );

  const pendingQ = useQuery({
    queryKey: ["videos", videoId, "suggested-shot-events", "suggested"],
    queryFn: () => client.videosSuggestedShotEventsList(videoId, "suggested"),
  });

  const allQ = useQuery({
    queryKey: ["videos", videoId, "suggested-shot-events", "all"],
    queryFn: () => client.videosSuggestedShotEventsList(videoId, "all"),
  });

  const statsQ = useQuery({
    queryKey: ["videos", videoId, "suggested-shot-events", "stats"],
    queryFn: () => client.videosSuggestedShotEventsStats(videoId),
  });

  const visible = useMemo(() => {
    const pending = pendingQ.data ?? [];
    const all = allQ.data ?? [];
    if (listFilter === "all") {
      return [...all].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
    }
    const base = listFilter === "high" ? pending.filter((s) => s.confidence >= confidenceThreshold) : pending;
    return [...base].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  }, [allQ.data, pendingQ.data, listFilter, confidenceThreshold]);

  const pending = pendingQ.data ?? [];

  const focusablePending = useMemo(
    () => visible.filter((s) => s.status === "suggested"),
    [visible],
  );

  useEffect(() => {
    setFocusIndex(0);
  }, [listFilter, confidenceThreshold, pending.length]);

  const focused =
    focusablePending[Math.min(focusIndex, Math.max(0, focusablePending.length - 1))] ?? null;

  useEffect(() => {
    onFocusChange?.(focused);
  }, [focused, onFocusChange]);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["videos", videoId, "suggested-shot-events"] });
    void qc.invalidateQueries({ queryKey: ["videos", videoId, "shot-events"] });
  }, [qc, videoId]);

  const rejectMut = useMutation({
    mutationFn: (id: string) => client.suggestedShotEventsReject(id, { status: "rejected" }),
    onSuccess: invalidate,
  });

  const convertBody = useCallback(
    (sug?: SuggestedShotEventDTO): ConvertSuggestedShotBody => ({
      rallyId: activeRallyId ?? undefined,
      playerSlot: playerSlot ?? undefined,
      endsRally: sug?.debugMetadata?.endOfRallyLikely ?? undefined,
    }),
    [activeRallyId, playerSlot],
  );

  const convertMut = useMutation({
    mutationFn: (id: string) => {
      const sug = (pendingQ.data ?? []).find((s) => s.id === id);
      return client.videosSuggestedShotEventConvert(videoId, id, convertBody(sug));
    },
    onSuccess: invalidate,
  });

  const batchMut = useMutation({
    mutationFn: () =>
      client.videosSuggestedShotEventsConvertBatch(videoId, {
        minConfidence: confidenceThreshold,
        rallyId: activeRallyId ?? undefined,
        playerSlot: playerSlot ?? undefined,
      }),
    onSuccess: invalidate,
  });

  const regenerateMut = useMutation({
    mutationFn: () => client.videosSuggestedShotEventsRegenerate(videoId),
    onSuccess: (summary) => {
      setRegenerateSummary(summary);
      invalidate();
    },
    onError: () => setRegenerateSummary(null),
  });

  const busy =
    rejectMut.isPending ||
    convertMut.isPending ||
    batchMut.isPending ||
    regenerateMut.isPending;

  const acceptFocused = useCallback(() => {
    if (!focused) return;
    convertMut.mutate(focused.id);
  }, [focused, convertMut]);

  const rejectFocused = useCallback(() => {
    if (!focused) return;
    rejectMut.mutate(focused.id);
  }, [focused, rejectMut]);

  useEffect(() => {
    if (disableShortcuts) return;

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.code === "KeyA" && focused) {
        e.preventDefault();
        acceptFocused();
        return;
      }
      if (e.code === "KeyX" && focused) {
        e.preventDefault();
        rejectFocused();
        return;
      }
      if (e.code === "ArrowDown" && focusablePending.length > 0) {
        e.preventDefault();
        setFocusIndex((i) => Math.min(i + 1, focusablePending.length - 1));
      }
      if (e.code === "ArrowUp" && focusablePending.length > 0) {
        e.preventDefault();
        setFocusIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disableShortcuts, focused, focusablePending.length, acceptFocused, rejectFocused]);

  const stats = statsQ.data;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Suggested moments ({pending.length} pending)</CardTitle>
        <CardDescription>
          Multi-signal heuristics (scene + audio + motion). Shortcuts: A accept · X reject · ↑↓ focus.
          {processingStatus !== "ready" && processingStatus !== "failed" && (
            <span className="mt-1 block text-amber-600 dark:text-amber-500">
              More suggestions may appear after processing finishes.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {stats && (
          <div className="bg-muted/50 text-muted-foreground grid grid-cols-3 gap-2 rounded-md border p-2 text-xs">
            <div>
              <span className="text-foreground font-medium">{stats.suggested}</span> pending
            </div>
            <div>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{stats.accepted}</span>{" "}
              accepted
            </div>
            <div>
              <span className="font-medium">{stats.rejected}</span> rejected
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="flex items-center justify-between gap-2 text-xs font-medium">
            <span>Confidence threshold ({Math.round(confidenceThreshold * 100)}%)</span>
            <span className="text-muted-foreground font-normal">
              {pending.filter((s) => s.confidence >= confidenceThreshold).length} / {pending.length} pending
            </span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(confidenceThreshold * 100)}
            onChange={(e) => setConfidenceThreshold(Number(e.target.value) / 100)}
            className="w-full"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={listFilter}
            onChange={(e) => setListFilter(e.target.value as ListFilter)}
            className="border-input bg-background h-8 rounded-md border px-2 text-xs"
          >
            <option value="pending">All pending</option>
            <option value="high">High confidence only</option>
            <option value="all">All (incl. accepted/rejected)</option>
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || pending.length === 0}
            onClick={() => batchMut.mutate()}
          >
            Accept all ≥ threshold
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setDebugMode((d) => !d)}
          >
            {debugMode ? "Hide debug" : "Debug"}
          </Button>
          {processingStatus === "ready" && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => regenerateMut.mutate()}
            >
              {regenerateMut.isPending ? "Regenerating…" : "Regenerate suggestions"}
            </Button>
          )}
        </div>

        {regenerateMut.error && (
          <p className="text-destructive text-xs">
            {regenerateMut.error instanceof ApiClientError
              ? regenerateMut.error.message
              : "Regeneration failed"}
          </p>
        )}
        {regenerateSummary && !regenerateMut.isPending && (
          <p className="text-emerald-700 dark:text-emerald-400 text-xs">
            Regenerated {regenerateSummary.generatedCount} suggestions (avg{" "}
            {Math.round(regenerateSummary.averageConfidence * 100)}%). Pending:{" "}
            {regenerateSummary.pendingCount} · accepted: {regenerateSummary.acceptedCount} · rejected:{" "}
            {regenerateSummary.rejectedCount}
          </p>
        )}

        {debugMode && (
          <div className="bg-muted/40 space-y-1 rounded-md border p-2 font-mono text-[11px]">
            <p className="text-muted-foreground">Tuning (worker env): SUGGESTION_MIN_CONFIDENCE, MIN_SPACING_SEC, weights…</p>
            {stats && (
              <p>
                avg pending conf: {stats.avgConfidenceSuggested?.toFixed(2) ?? "—"} · avg accepted:{" "}
                {stats.avgConfidenceAccepted?.toFixed(2) ?? "—"}
              </p>
            )}
          </div>
        )}

        {pendingQ.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {pendingQ.isError && (
          <p className="text-destructive text-xs">
            {pendingQ.error instanceof ApiClientError ? pendingQ.error.message : "Could not load suggestions"}
          </p>
        )}

        {!pendingQ.isLoading && visible.length === 0 && (
          <p className="text-muted-foreground">No suggestions match this filter.</p>
        )}

        <div className="max-h-[min(40vh,360px)] space-y-2 overflow-y-auto">
          {visible.map((s) => {
            const isFocused = focused?.id === s.id;
            return (
              <div
                key={s.id}
                className={rowClass(s.status, isFocused)}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (s.status === "suggested") {
                    const idx = focusablePending.findIndex((x) => x.id === s.id);
                    if (idx >= 0) setFocusIndex(idx);
                  }
                  seekTo(s.timestampSeconds);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    seekTo(s.timestampSeconds);
                  }
                }}
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-muted-foreground">{formatClock(s.timestampSeconds)}</p>
                    <p className="font-medium">
                      {Math.round(s.confidence * 100)}% confidence
                      {s.status !== "suggested" && (
                        <span className="text-muted-foreground ml-1 text-xs">· {s.status}</span>
                      )}
                    </p>
                    {s.reason && <p className="text-muted-foreground text-xs">{s.reason}</p>}
                    {debugMode && (
                      <div className="text-muted-foreground mt-1 space-y-0.5 font-mono text-[10px]">
                        {s.audioPeak != null && <p>audio: {(s.audioPeak * 100).toFixed(0)}%</p>}
                        {s.motionScore != null && <p>motion: {(s.motionScore * 100).toFixed(0)}%</p>}
                        {s.debugMetadata?.sceneScore != null && (
                          <p>scene: {(s.debugMetadata.sceneScore * 100).toFixed(0)}%</p>
                        )}
                        {s.debugMetadata?.generatedAt && (
                          <p>generated: {new Date(s.debugMetadata.generatedAt).toLocaleString()}</p>
                        )}
                        {s.debugMetadata?.suppressedSpacing != null && (
                          <p>
                            suppressed: th={s.debugMetadata.suppressedBelowThreshold ?? 0} sp=
                            {s.debugMetadata.suppressedSpacing ?? 0}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {s.status === "suggested" && (
                    <div className="flex shrink-0 flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          rejectMut.mutate(s.id);
                        }}
                      >
                        Reject (X)
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          convertMut.mutate(s.id);
                        }}
                      >
                        Accept (A)
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {(rejectMut.error || convertMut.error || batchMut.error) && (
          <p className="text-destructive text-xs">
            {(rejectMut.error as Error)?.message ??
              (convertMut.error as Error)?.message ??
              (batchMut.error as Error)?.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
