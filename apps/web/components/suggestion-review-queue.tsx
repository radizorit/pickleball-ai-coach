"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuthedApiClient } from "@/lib/api/use-authed-api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SuggestedShotEventDTO } from "@pickleball/shared";
import type { ConvertSuggestedShotBody } from "@pickleball/shared/zod";
import type { ShotOutcome, ShotSide, ShotType, VideoPlayerSlot } from "@pickleball/shared/constants";

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const frac = seconds % 1;
  const dec = frac >= 0.05 ? `.${Math.floor(frac * 10)}` : "";
  return `${m}:${s.toString().padStart(2, "0")}${dec}`;
}

export type QuickAcceptPreset = {
  id: string;
  label: string;
  shotType: ShotType;
  side: ShotSide;
  outcome: ShotOutcome;
};

export const QUICK_ACCEPT_PRESETS: QuickAcceptPreset[] = [
  { id: "fh-w", label: "Forehand winner", shotType: "forehand", side: "forehand", outcome: "winner" },
  {
    id: "fh-e",
    label: "Forehand error",
    shotType: "forehand",
    side: "forehand",
    outcome: "unforced_error",
  },
  { id: "bh-w", label: "Backhand winner", shotType: "backhand", side: "backhand", outcome: "winner" },
  {
    id: "bh-e",
    label: "Backhand error",
    shotType: "backhand",
    side: "backhand",
    outcome: "unforced_error",
  },
  { id: "sv-e", label: "Serve error", shotType: "serve", side: "unknown", outcome: "unforced_error" },
  { id: "rt-e", label: "Return error", shotType: "return", side: "unknown", outcome: "unforced_error" },
  { id: "dk-e", label: "Dink error", shotType: "dink", side: "unknown", outcome: "unforced_error" },
  { id: "vl-e", label: "Volley error", shotType: "volley", side: "unknown", outcome: "unforced_error" },
];

export function SuggestionReviewQueue({
  videoId,
  isYoutube,
  seekTo,
  onQueueActiveChange,
  onCurrentSuggestionChange,
  activeRallyId = null,
  focusPlayerSlot = "player_1",
}: {
  videoId: string;
  isYoutube: boolean;
  seekTo: (seconds: number) => void;
  onQueueActiveChange?: (active: boolean) => void;
  onCurrentSuggestionChange?: (suggestion: SuggestedShotEventDTO | null) => void;
  activeRallyId?: string | null;
  focusPlayerSlot?: VideoPlayerSlot;
}) {
  const client = useAuthedApiClient();
  const qc = useQueryClient();

  const [queueMode, setQueueMode] = useState(false);
  const [queueIndex, setQueueIndex] = useState(0);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(QUICK_ACCEPT_PRESETS[0]!.id);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const pendingQ = useQuery({
    queryKey: ["videos", videoId, "suggested-shot-events", "suggested"],
    queryFn: () => client.videosSuggestedShotEventsList(videoId, "suggested"),
    enabled: !isYoutube,
  });

  const statsQ = useQuery({
    queryKey: ["videos", videoId, "suggested-shot-events", "stats"],
    queryFn: () => client.videosSuggestedShotEventsStats(videoId),
    enabled: !isYoutube,
  });

  const pending = useMemo(() => {
    const rows = pendingQ.data ?? [];
    return [...rows].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  }, [pendingQ.data]);

  const current = pending[Math.min(queueIndex, Math.max(0, pending.length - 1))] ?? null;

  const selectedPreset =
    QUICK_ACCEPT_PRESETS.find((p) => p.id === selectedPresetId) ?? QUICK_ACCEPT_PRESETS[0]!;

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["videos", videoId, "suggested-shot-events"] });
    void qc.invalidateQueries({ queryKey: ["videos", videoId, "shot-events"] });
  }, [qc, videoId]);

  const rejectMut = useMutation({
    mutationFn: (id: string) => client.suggestedShotEventsReject(id, { status: "rejected" }),
    onSuccess: () => {
      invalidate();
      setSessionReviewed((n) => n + 1);
    },
  });

  const convertMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ConvertSuggestedShotBody }) =>
      client.videosSuggestedShotEventConvert(videoId, id, body),
    onSuccess: () => {
      invalidate();
      setSessionReviewed((n) => n + 1);
    },
  });

  const busy = rejectMut.isPending || convertMut.isPending;

  useEffect(() => {
    onQueueActiveChange?.(queueMode);
  }, [queueMode, onQueueActiveChange]);

  useEffect(() => {
    onCurrentSuggestionChange?.(queueMode ? current : null);
  }, [queueMode, current, onCurrentSuggestionChange]);

  useEffect(() => {
    if (!queueMode || !current) return;
    seekTo(current.timestampSeconds);
  }, [queueMode, current?.id, current?.timestampSeconds, seekTo]);

  useEffect(() => {
    if (queueIndex >= pending.length && pending.length > 0) {
      setQueueIndex(pending.length - 1);
    }
  }, [pending.length, queueIndex]);

  const goNext = useCallback(() => {
    setQueueIndex((i) => Math.min(i + 1, Math.max(0, pending.length - 1)));
  }, [pending.length]);

  const goPrev = useCallback(() => {
    setQueueIndex((i) => Math.max(i - 1, 0));
  }, []);

  const rejectCurrent = useCallback(() => {
    if (!current || busy) return;
    rejectMut.mutate(current.id);
  }, [current, busy, rejectMut]);

  const acceptCurrent = useCallback(() => {
    if (!current || busy) return;
    const body: ConvertSuggestedShotBody = {
      shotType: selectedPreset.shotType,
      side: selectedPreset.side,
      outcome: selectedPreset.outcome,
      rallyId: activeRallyId ?? undefined,
      playerSlot: focusPlayerSlot,
      endsRally: current.debugMetadata?.endOfRallyLikely ?? undefined,
    };
    convertMut.mutate({ id: current.id, body });
  }, [current, busy, convertMut, selectedPreset, selectedPresetId, activeRallyId, focusPlayerSlot]);

  const startQueue = useCallback(() => {
    setSessionTotal(pending.length);
    setSessionReviewed(0);
    setQueueIndex(0);
    setQueueMode(true);
  }, [pending.length]);

  const exitQueue = useCallback(() => {
    setQueueMode(false);
    onCurrentSuggestionChange?.(null);
  }, [onCurrentSuggestionChange]);

  useEffect(() => {
    if (!queueMode) return;

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.code) {
        case "Enter":
          e.preventDefault();
          acceptCurrent();
          break;
        case "KeyX":
          e.preventDefault();
          rejectCurrent();
          break;
        case "ArrowRight":
          e.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queueMode, acceptCurrent, rejectCurrent, goNext, goPrev]);

  if (isYoutube) {
    return null;
  }

  const stats = statsQ.data;
  const overallTotal =
    stats != null ? stats.suggested + stats.accepted + stats.rejected : 0;
  const overallReviewed = stats != null ? stats.accepted + stats.rejected : 0;

  return (
    <Card className={queueMode ? "border-primary ring-1 ring-primary/30" : undefined}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Review queue</CardTitle>
            <CardDescription>
              Step through pending suggestions with labeled accepts for training export.
            </CardDescription>
          </div>
          {!queueMode ? (
            <Button type="button" size="sm" disabled={pending.length === 0} onClick={startQueue}>
              Start review queue
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={exitQueue}>
              Exit queue
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {stats && (
          <div className="text-muted-foreground grid grid-cols-2 gap-2 rounded-md border p-2 text-xs sm:grid-cols-5">
            <div>
              <span className="text-foreground font-medium">
                {overallReviewed} / {overallTotal}
              </span>{" "}
              reviewed
            </div>
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
            {queueMode && sessionTotal > 0 && (
              <div>
                <span className="text-foreground font-medium">
                  {sessionReviewed} / {sessionTotal}
                </span>{" "}
                this session
              </div>
            )}
          </div>
        )}

        {!queueMode && (
          <p className="text-muted-foreground text-xs">
            Opens one suggestion at a time. Uploads auto-seek the player; use quick tags for rich training
            labels. Shortcuts: Enter accept · X reject · ← → navigate.
          </p>
        )}

        {queueMode && pendingQ.isLoading && <p className="text-muted-foreground">Loading queue…</p>}

        {queueMode && !pendingQ.isLoading && pending.length === 0 && (
          <p className="text-emerald-700 dark:text-emerald-400">
            Queue complete — no pending suggestions left.
          </p>
        )}

        {queueMode && current && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-lg font-semibold tabular-nums">{formatClock(current.timestampSeconds)}</p>
              <p className="text-muted-foreground text-xs">
                Item {queueIndex + 1} of {pending.length} · {Math.round(current.confidence * 100)}% confidence
              </p>
            </div>
            {current.reason && <p className="text-muted-foreground text-xs">{current.reason}</p>}

            <div>
              <p className="mb-1 text-xs font-medium">Quick accept as</p>
              <div className="flex flex-wrap gap-1">
                {QUICK_ACCEPT_PRESETS.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant={selectedPresetId === p.id ? "default" : "outline"}
                    disabled={busy}
                    onClick={() => setSelectedPresetId(p.id)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                Selected: {selectedPreset.shotType} · {selectedPreset.side} · {selectedPreset.outcome}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={acceptCurrent}>
                Accept (Enter)
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={rejectCurrent}>
                Reject (X)
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={busy || queueIndex <= 0} onClick={goPrev}>
                ← Prev
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy || queueIndex >= pending.length - 1}
                onClick={goNext}
              >
                Next →
              </Button>
            </div>
          </div>
        )}

        {(rejectMut.error || convertMut.error) && (
          <p className="text-destructive text-xs">
            {(rejectMut.error as Error)?.message ?? (convertMut.error as Error)?.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
