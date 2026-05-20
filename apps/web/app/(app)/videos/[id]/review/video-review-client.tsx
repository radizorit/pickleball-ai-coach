"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiClientError } from "@/lib/api/client";
import { useAuthedApiClient } from "@/lib/api/use-authed-api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RallyConsistencyPanel } from "@/components/rally-consistency-panel";
import { CourtCornersPanel } from "@/components/court-corners-panel";
import { RallyPanel } from "@/components/rally-panel";
import { SuggestedRallyProposals } from "@/components/suggested-rally-proposals";
import { SuggestedShotsPanel } from "@/components/suggested-shots-panel";
import { SuggestionReviewQueue } from "@/components/suggestion-review-queue";
import { VideoCoachingFeedbackPanel } from "@/components/video-coaching-feedback-panel";
import { VideoShotStatsPanel } from "@/components/video-shot-stats-panel";
import type {
  ShotEventDTO,
  SuggestedShotEventDTO,
  VideoDTO,
  VideoPlayerDTO,
  VideoSideSwitchDTO,
  SuggestedRallyDTO,
  VideoRallyDTO,
} from "@pickleball/shared";
import type { ShotSide, VideoPlayerSlot } from "@pickleball/shared/constants";
import type { CreateShotEventBody, UpdateShotEventBody } from "@pickleball/shared/zod";
import {
  SHOT_OUTCOMES,
  SHOT_SIDES,
  SHOT_TYPES,
} from "@pickleball/shared/constants";
import { parseYouTubeVideoId } from "@pickleball/shared";

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const frac = seconds % 1;
  const dec = frac >= 0.05 ? `.${Math.floor(frac * 10)}` : "";
  return `${m}:${s.toString().padStart(2, "0")}${dec}`;
}

function sideLabel(s: ShotSide): string {
  if (s === "n_a") return "N/A";
  return s;
}

function playerTag(
  slot: VideoPlayerSlot | null,
  players: VideoPlayerDTO[],
): string | null {
  if (!slot) return null;
  const name = players.find((p) => p.slot === slot)?.displayName?.trim();
  if (name) return name;
  if (slot === "player_1") return "Me";
  return slot;
}

function meDisplayName(players: VideoPlayerDTO[]): string {
  return players.find((p) => p.slot === "player_1")?.displayName?.trim() || "Me";
}

function canRequestSourceRead(status: VideoDTO["processingStatus"]): boolean {
  return status === "uploaded" || status === "processing" || status === "ready" || status === "failed";
}

export function VideoReviewClient({ videoId }: { videoId: string }) {
  const client = useAuthedApiClient();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoQ = useQuery({
    queryKey: ["videos", videoId],
    queryFn: () => client.videosGet(videoId),
  });

  const v = videoQ.data;
  const isYoutube = Boolean(v?.youtubeUrl);
  const ytId = v?.youtubeUrl ? parseYouTubeVideoId(v.youtubeUrl) : null;
  const sourceEnabled = Boolean(v && !isYoutube && canRequestSourceRead(v.processingStatus));

  const sourceRead = useQuery({
    queryKey: ["videos", videoId, "read-url", "source"],
    queryFn: () => client.videosReadUrl(videoId, "source"),
    enabled: sourceEnabled && videoQ.isSuccess,
    staleTime: 120_000,
  });

  const eventsQ = useQuery({
    queryKey: ["videos", videoId, "shot-events"],
    queryFn: () => client.videosShotEventsList(videoId),
    enabled: videoQ.isSuccess,
  });

  const playersQ = useQuery({
    queryKey: ["videos", videoId, "players"],
    queryFn: () => client.videosPlayersList(videoId),
    enabled: videoQ.isSuccess,
  });

  const ralliesQ = useQuery({
    queryKey: ["videos", videoId, "rallies"],
    queryFn: () => client.videosRalliesList(videoId),
    enabled: videoQ.isSuccess,
  });

  const rallyConsistencyQ = useQuery({
    queryKey: ["videos", videoId, "rally-consistency"],
    queryFn: () => client.videosRallyConsistency(videoId),
    enabled: videoQ.isSuccess,
  });

  const allSuggestionsQ = useQuery({
    queryKey: ["videos", videoId, "suggested-shot-events", "all"],
    queryFn: () => client.videosSuggestedShotEventsList(videoId, "all"),
    enabled: videoQ.isSuccess && !isYoutube,
  });

  const suggestedRalliesQ = useQuery({
    queryKey: ["videos", videoId, "suggested-rallies"],
    queryFn: () => client.videosSuggestedRalliesList(videoId),
    enabled: videoQ.isSuccess && !isYoutube,
  });

  const sideSwitchesQ = useQuery({
    queryKey: ["videos", videoId, "side-switches"],
    queryFn: () => client.videosSideSwitchesList(videoId),
    enabled: videoQ.isSuccess,
  });

  const [videoClock, setVideoClock] = useState(0);
  const [manualClock, setManualClock] = useState(0);
  const activeClock = isYoutube ? manualClock : videoClock;

  const [shotType, setShotType] = useState<ShotEventDTO["shotType"]>("unknown");
  const [side, setSide] = useState<ShotEventDTO["side"]>("unknown");
  const [outcome, setOutcome] = useState<ShotEventDTO["outcome"]>("unknown");
  const [note, setNote] = useState("");
  const [activeRallyId, setActiveRallyId] = useState<string | null>(null);
  const [endsRally, setEndsRally] = useState(false);
  const [sideSwitchNotice, setSideSwitchNotice] = useState<string | null>(null);

  const focusPlayerSlot: VideoPlayerSlot = "player_1";
  const players = playersQ.data ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editShotType, setEditShotType] = useState<ShotEventDTO["shotType"]>("unknown");
  const [editSide, setEditSide] = useState<ShotEventDTO["side"]>("unknown");
  const [editOutcome, setEditOutcome] = useState<ShotEventDTO["outcome"]>("unknown");
  const [editNote, setEditNote] = useState("");
  const [editTs, setEditTs] = useState(0);
  const [editEndsRally, setEditEndsRally] = useState(false);
  const [editRallyId, setEditRallyId] = useState<string | null>(null);

  const durationSeconds = v?.durationSeconds ?? null;
  const timelineMax = useMemo(() => {
    const events = eventsQ.data ?? [];
    const allSuggestions = allSuggestionsQ.data ?? [];
    const proposedRallies = suggestedRalliesQ.data ?? [];
    const maxEv = events.reduce((m, e) => Math.max(m, e.timestampSeconds), 0);
    const maxSug = allSuggestions.reduce((m, s) => Math.max(m, s.timestampSeconds), 0);
    const maxRally = proposedRallies.reduce((m, r) => Math.max(m, r.endTimeSeconds), 0);
    const base = durationSeconds && durationSeconds > 0 ? durationSeconds : Math.max(maxEv, maxSug, maxRally);
    return Math.max(base || 1, 1);
  }, [durationSeconds, eventsQ.data, allSuggestionsQ.data, suggestedRalliesQ.data]);
  const allSuggestions = allSuggestionsQ.data ?? [];
  const proposedRallies = (suggestedRalliesQ.data ?? []).filter((r) => r.status === "suggested");
  const confirmedRallies = ralliesQ.data ?? [];

  const [focusedSuggestion, setFocusedSuggestion] = useState<SuggestedShotEventDTO | null>(null);
  const [reviewQueueActive, setReviewQueueActive] = useState(false);
  const [queueCurrentSuggestion, setQueueCurrentSuggestion] = useState<SuggestedShotEventDTO | null>(null);
  const timelineHighlightSuggestion = reviewQueueActive ? queueCurrentSuggestion : focusedSuggestion;

  const invalidateRallyData = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["videos", videoId, "shot-events"] });
    void qc.invalidateQueries({ queryKey: ["videos", videoId, "rallies"] });
    void qc.invalidateQueries({ queryKey: ["videos", videoId, "rally-consistency"] });
  }, [qc, videoId]);

  const createMut = useMutation({
    mutationFn: (body: CreateShotEventBody) => client.videosShotEventsCreate(videoId, body),
    onSuccess: () => {
      invalidateRallyData();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateShotEventBody }) =>
      client.shotEventsUpdate(id, body),
    onSuccess: () => {
      invalidateRallyData();
      setEditingId(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => client.shotEventsDelete(id),
    onSuccess: () => {
      invalidateRallyData();
    },
  });

  const createSideSwitchMut = useMutation({
    mutationFn: () =>
      client.videosSideSwitchesCreate(videoId, { timestampSeconds: activeClock }),
    onSuccess: (sw) => {
      void qc.invalidateQueries({ queryKey: ["videos", videoId, "side-switches"] });
      setSideSwitchNotice(`Side switch recorded at ${formatClock(sw.timestampSeconds)}`);
    },
  });

  const deleteSideSwitchMut = useMutation({
    mutationFn: (id: string) => client.sideSwitchesDelete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["videos", videoId, "side-switches"] });
    },
  });

  const trainingExportMut = useMutation({
    mutationFn: async () => {
      const data = await client.videosTrainingExport(videoId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `training-export-${videoId.slice(0, 8)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });

  const invalidateAllLabelData = useCallback(() => {
    invalidateRallyData();
    void qc.invalidateQueries({ queryKey: ["videos", videoId, "side-switches"] });
    void qc.invalidateQueries({ queryKey: ["videos", videoId, "suggested-shot-events"] });
    void qc.invalidateQueries({ queryKey: ["videos", videoId, "suggested-rallies"] });
    setActiveRallyId(null);
    setEditingId(null);
    setSideSwitchNotice(null);
  }, [invalidateRallyData, qc, videoId]);

  const resetLabelsMut = useMutation({
    mutationFn: () => client.videosResetLabels(videoId),
    onSuccess: (summary) => {
      invalidateAllLabelData();
      setSideSwitchNotice(
        `Cleared ${summary.deletedShots} shots, ${summary.deletedRallies} rallies, ${summary.deletedSideSwitches} side switches.`,
      );
    },
  });

  const addShot = useCallback(() => {
    const body: CreateShotEventBody = {
      timestampSeconds: activeClock,
      shotType,
      side,
      outcome,
      note: note.trim() === "" ? undefined : note.trim(),
      rallyId: activeRallyId ?? undefined,
      playerSlot: focusPlayerSlot,
      endsRally: activeRallyId ? endsRally : undefined,
    };
    createMut.mutate(body);
    setNote("");
    if (endsRally) setEndsRally(false);
  }, [
    activeClock,
    shotType,
    side,
    outcome,
    note,
    activeRallyId,
    focusPlayerSlot,
    endsRally,
    createMut,
  ]);

  const quickCreate = useCallback(
    (partial: Partial<Pick<CreateShotEventBody, "shotType" | "side" | "outcome">>) => {
      const body: CreateShotEventBody = {
        timestampSeconds: activeClock,
        shotType: partial.shotType ?? "unknown",
        side: partial.side ?? "unknown",
        outcome: partial.outcome ?? "unknown",
        rallyId: activeRallyId ?? undefined,
        playerSlot: focusPlayerSlot,
        endsRally: activeRallyId ? endsRally : undefined,
      };
      createMut.mutate(body);
      if (endsRally) setEndsRally(false);
    },
    [activeClock, activeRallyId, focusPlayerSlot, endsRally, createMut],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)
      ) {
        return;
      }
      if (editingId) return;
      if (reviewQueueActive) return;
      if (focusedSuggestion) return;

      if (e.code === "Space" && videoRef.current && !isYoutube) {
        e.preventDefault();
        const el = videoRef.current;
        if (el.paused) void el.play();
        else el.pause();
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.code) {
        case "KeyF":
          quickCreate({ shotType: "forehand", side: "forehand" });
          break;
        case "KeyB":
          quickCreate({ shotType: "backhand", side: "backhand" });
          break;
        case "KeyS":
          quickCreate({ shotType: "serve" });
          break;
        case "KeyR":
          quickCreate({ shotType: "return" });
          break;
        case "KeyD":
          quickCreate({ shotType: "dink" });
          break;
        case "KeyV":
          quickCreate({ shotType: "volley" });
          break;
        case "KeyE":
          quickCreate({ outcome: "unforced_error" });
          break;
        case "KeyW":
          quickCreate({ outcome: "winner" });
          break;
        case "KeyN":
          quickCreate({ outcome: "net" });
          break;
        case "KeyO":
          quickCreate({ outcome: "out" });
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingId, reviewQueueActive, focusedSuggestion, isYoutube, quickCreate]);

  const seekTo = useCallback(
    (seconds: number) => {
      if (!isYoutube && videoRef.current) {
        videoRef.current.currentTime = Math.max(0, seconds);
        setVideoClock(videoRef.current.currentTime);
      } else {
        setManualClock(seconds);
      }
    },
    [isYoutube],
  );

  const startEdit = useCallback((ev: ShotEventDTO) => {
    setEditingId(ev.id);
    setEditShotType(ev.shotType);
    setEditSide(ev.side);
    setEditOutcome(ev.outcome);
    setEditNote(ev.note ?? "");
    setEditTs(ev.timestampSeconds);
    setEditEndsRally(ev.endsRally);
    setEditRallyId(ev.rallyId);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingId) return;
    const body: UpdateShotEventBody = {
      timestampSeconds: editTs,
      shotType: editShotType,
      side: editSide,
      outcome: editOutcome,
      note: editNote.trim() === "" ? null : editNote.trim(),
      rallyId: editRallyId,
      playerSlot: focusPlayerSlot,
      endsRally: editRallyId ? editEndsRally : false,
    };
    updateMut.mutate({ id: editingId, body });
  }, [
    editingId,
    editTs,
    editShotType,
    editSide,
    editOutcome,
    editNote,
    editRallyId,
    editEndsRally,
    focusPlayerSlot,
    updateMut,
  ]);

  const events = eventsQ.data ?? [];
  const rallies = ralliesQ.data ?? [];

  const rallyIndexById = useMemo(() => {
    const m = new Map<string, number>();
    rallies.forEach((r, i) => m.set(r.id, i + 1));
    return m;
  }, [rallies]);

  const sideSwitches = sideSwitchesQ.data ?? [];

  const busy =
    createMut.isPending ||
    updateMut.isPending ||
    deleteMut.isPending ||
    trainingExportMut.isPending ||
    resetLabelsMut.isPending ||
    createSideSwitchMut.isPending ||
    deleteSideSwitchMut.isPending;

  if (videoQ.isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-muted h-8 w-64 animate-pulse rounded-md" />
        <div className="bg-muted h-48 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (videoQ.error || !v) {
    const err = videoQ.error instanceof ApiClientError ? videoQ.error : null;
    return (
      <Card className="border-destructive/50 max-w-lg">
        <CardHeader>
          <CardTitle className="text-destructive">Could not load video</CardTitle>
          <CardDescription>{err ? `${err.statusCode} · ${err.code}` : "Request failed"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">{err?.message ?? "Unknown error"}</p>
          <Button variant="outline" asChild>
            <Link href="/videos">Back</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link href={`/videos/${videoId}`}>← Video details</Link>
          </Button>
          <p className="text-primary text-sm font-medium uppercase tracking-wider">Review</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{v.title}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            Manual shot tags at the active clock. Keyboard: F/B/S/R/D/V (types), E/W/N/O (outcomes), Space
            play/pause (uploaded file only).
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    "Clear all shots, rallies, side switches, and reset accepted/rejected suggestions on this video? This cannot be undone.",
                  )
                ) {
                  return;
                }
                resetLabelsMut.mutate();
              }}
            >
              {resetLabelsMut.isPending ? "Clearing…" : "Clear all labels"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => trainingExportMut.mutate()}
            >
              {trainingExportMut.isPending ? "Exporting…" : "Download training export"}
            </Button>
          </div>
          {resetLabelsMut.error && (
            <p className="text-destructive max-w-xs text-right text-xs">
              {resetLabelsMut.error instanceof ApiClientError
                ? resetLabelsMut.error.message
                : "Reset failed"}
            </p>
          )}
          {trainingExportMut.error && (
            <p className="text-destructive max-w-xs text-right text-xs">
              {trainingExportMut.error instanceof ApiClientError
                ? trainingExportMut.error.message
                : "Export failed"}
            </p>
          )}
        </div>
      </div>

      <VideoShotStatsPanel
        videoId={videoId}
        events={eventsQ.data}
        isLoading={eventsQ.isLoading}
        focusPlayerSlot={focusPlayerSlot}
        players={players}
      />

      <RallyConsistencyPanel
        videoId={videoId}
        players={players}
        focusPlayerSlot={focusPlayerSlot}
      />

      <VideoCoachingFeedbackPanel
        events={eventsQ.data}
        isLoading={eventsQ.isLoading}
        rallyStats={rallyConsistencyQ.data}
        focusPlayerSlot={focusPlayerSlot}
        players={players}
      />

      {!isYoutube && (
        <SuggestionReviewQueue
          videoId={videoId}
          isYoutube={isYoutube}
          seekTo={seekTo}
          onQueueActiveChange={setReviewQueueActive}
          onCurrentSuggestionChange={setQueueCurrentSuggestion}
          activeRallyId={activeRallyId}
          focusPlayerSlot={focusPlayerSlot}
        />
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Player</CardTitle>
              <CardDescription>
                {isYoutube
                  ? "YouTube embed — set the tag time with the number field (no native seek binding)."
                  : "Signed source URL for your upload."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isYoutube && ytId && (
                <div className="aspect-video w-full overflow-hidden rounded-lg border">
                  <iframe
                    title="YouTube"
                    src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
              )}
              {isYoutube && !ytId && (
                <p className="text-destructive text-sm">Could not parse YouTube id from stored URL.</p>
              )}
              {!isYoutube && sourceRead.isLoading && (
                <p className="text-muted-foreground text-sm">Loading video…</p>
              )}
              {!isYoutube && sourceRead.data && (
                <video
                  ref={videoRef}
                  key={sourceRead.data.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="bg-muted w-full rounded-lg border"
                  src={sourceRead.data.url}
                  onTimeUpdate={() => {
                    if (videoRef.current) setVideoClock(videoRef.current.currentTime);
                  }}
                  onLoadedMetadata={() => {
                    if (videoRef.current) setVideoClock(videoRef.current.currentTime);
                  }}
                />
              )}
              {!isYoutube && sourceRead.error && (
                <p className="text-destructive text-sm">
                  {sourceRead.error instanceof ApiClientError
                    ? sourceRead.error.message
                    : "Could not load video"}
                </p>
              )}
              {!isYoutube && !sourceEnabled && (
                <p className="text-muted-foreground text-sm">
                  Playback is available after the file reaches <code className="bg-muted rounded px-1 text-xs">uploaded</code>{" "}
                  (see video details).
                </p>
              )}
            </CardContent>
          </Card>

          <div className="bg-muted/40 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Timeline</p>
            <div className="relative mt-2 h-6 w-full rounded-full bg-muted">
              {confirmedRallies.map((r) => {
                const left = (r.startTimeSeconds / timelineMax) * 100;
                const end = r.endTimeSeconds ?? r.startTimeSeconds + 1;
                const width = Math.max(0.5, ((end - r.startTimeSeconds) / timelineMax) * 100);
                return (
                  <button
                    key={`rally-${r.id}`}
                    type="button"
                    title={`Rally ${formatClock(r.startTimeSeconds)} – ${r.endTimeSeconds != null ? formatClock(r.endTimeSeconds) : "open"}`}
                    className={`absolute top-0 h-full rounded-sm opacity-40 ${activeRallyId === r.id ? "bg-primary opacity-70" : "bg-primary/60"}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    onClick={() => {
                      setActiveRallyId(r.id);
                      seekTo(r.startTimeSeconds);
                    }}
                  />
                );
              })}
              {proposedRallies.map((r: SuggestedRallyDTO) => {
                const left = (r.startTimeSeconds / timelineMax) * 100;
                const width = Math.max(
                  0.5,
                  ((r.endTimeSeconds - r.startTimeSeconds) / timelineMax) * 100,
                );
                return (
                  <button
                    key={`prop-${r.id}`}
                    type="button"
                    title={`Proposed ${formatClock(r.startTimeSeconds)} – ${formatClock(r.endTimeSeconds)}`}
                    className="border-amber-500/80 absolute top-0 h-full rounded-sm border border-dashed bg-amber-500/20"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    onClick={() => seekTo(r.startTimeSeconds)}
                  />
                );
              })}
              {allSuggestions.map((s) => {
                const pct = Math.min(100, (s.timestampSeconds / timelineMax) * 100);
                const title = `${s.status} ${formatClock(s.timestampSeconds)} · ${Math.round(s.confidence * 100)}%`;
                if (s.status === "accepted") {
                  return (
                    <button
                      key={`sug-${s.id}`}
                      type="button"
                      title={title}
                      className="bg-emerald-500 ring-background absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
                      style={{ left: `${pct}%` }}
                      onClick={() => seekTo(s.timestampSeconds)}
                    />
                  );
                }
                if (s.status === "rejected") {
                  return (
                    <button
                      key={`sug-${s.id}`}
                      type="button"
                      title={title}
                      className="bg-muted-foreground/40 ring-background absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1"
                      style={{ left: `${pct}%` }}
                      onClick={() => seekTo(s.timestampSeconds)}
                    />
                  );
                }
                const isFocused = timelineHighlightSuggestion?.id === s.id;
                return (
                  <button
                    key={`sug-${s.id}`}
                    type="button"
                    title={title}
                    className={`border-primary bg-background ring-background absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ring-2 hover:border-primary/80 ${isFocused ? "ring-primary ring-4" : ""}`}
                    style={{ left: `${pct}%` }}
                    onClick={() => seekTo(s.timestampSeconds)}
                  />
                );
              })}
              {sideSwitches.map((sw: VideoSideSwitchDTO) => {
                const pct = Math.min(100, (sw.timestampSeconds / timelineMax) * 100);
                return (
                  <button
                    key={`sw-${sw.id}`}
                    type="button"
                    title={`Side switch ${formatClock(sw.timestampSeconds)}${sw.note ? ` · ${sw.note}` : ""}`}
                    className="bg-amber-500 ring-background absolute top-0 h-full w-0.5 -translate-x-1/2 rounded-sm ring-1 hover:bg-amber-400"
                    style={{ left: `${pct}%` }}
                    onClick={() => seekTo(sw.timestampSeconds)}
                  />
                );
              })}
              {events.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  title={`${formatClock(ev.timestampSeconds)} · ${ev.shotType}`}
                  className="bg-primary ring-background absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 hover:bg-primary/80"
                  style={{ left: `${Math.min(100, (ev.timestampSeconds / timelineMax) * 100)}%` }}
                  onClick={() => seekTo(ev.timestampSeconds)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="w-full shrink-0 space-y-4 lg:w-[380px]">
          {!isYoutube && v && <CourtCornersPanel video={v} />}
          {!isYoutube && (
            <SuggestedRallyProposals
              videoId={videoId}
              seekTo={seekTo}
              onRallyAccepted={setActiveRallyId}
            />
          )}
          <RallyPanel
            videoId={videoId}
            activeClock={activeClock}
            activeRallyId={activeRallyId}
            onActiveRallyChange={setActiveRallyId}
          />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tagging</CardTitle>
              <CardDescription>
                Me-only gold labels — see{" "}
                <Link href="/gold-label-rules" className="text-primary underline underline-offset-2">
                  gold label rules
                </Link>
                . Active clock: {formatClock(activeClock)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {sideSwitches.length > 0 && (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-200">
                  Me stays player_1 after side changes. Mark every end switch with{" "}
                  <strong>Switched ends</strong>.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => createSideSwitchMut.mutate()}
                >
                  Switched ends
                </Button>
                <span className="text-muted-foreground text-xs">
                  Tagging as {meDisplayName(players)} (player_1)
                </span>
              </div>
              {sideSwitchNotice && (
                <p className="text-emerald-700 dark:text-emerald-400 text-xs">{sideSwitchNotice}</p>
              )}
              {sideSwitches.length > 0 && (
                <ul className="space-y-1 text-xs">
                  {sideSwitches.map((sw) => (
                    <li key={sw.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => seekTo(sw.timestampSeconds)}
                      >
                        {formatClock(sw.timestampSeconds)}
                        {sw.note ? ` · ${sw.note}` : ""}
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-7 px-2"
                        disabled={busy}
                        onClick={() => deleteSideSwitchMut.mutate(sw.id)}
                      >
                        Delete
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {isYoutube && (
                <div className="space-y-1">
                  <label className="font-medium" htmlFor="manual-clock">
                    Tag time (seconds)
                  </label>
                  <input
                    id="manual-clock"
                    type="number"
                    min={0}
                    step={0.1}
                    value={Number.isFinite(manualClock) ? manualClock : 0}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setManualClock(Number.isFinite(n) ? n : 0);
                    }}
                    className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                  />
                </div>
              )}
              <div className="grid gap-2">
                <label className="font-medium">Shot type</label>
                <select
                  value={shotType}
                  onChange={(e) => setShotType(e.target.value as ShotEventDTO["shotType"])}
                  className="border-input bg-background flex h-9 rounded-md border px-2 text-sm"
                >
                  {SHOT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="font-medium">Side</label>
                <select
                  value={side}
                  onChange={(e) => setSide(e.target.value as ShotEventDTO["side"])}
                  className="border-input bg-background flex h-9 rounded-md border px-2 text-sm"
                >
                  {SHOT_SIDES.map((s) => (
                    <option key={s} value={s}>
                      {sideLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="font-medium">Outcome</label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as ShotEventDTO["outcome"])}
                  className="border-input bg-background flex h-9 rounded-md border px-2 text-sm"
                >
                  {SHOT_OUTCOMES.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              {activeRallyId && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={endsRally}
                    onChange={(e) => setEndsRally(e.target.checked)}
                    className="border-input rounded"
                  />
                  Ends rally (closes at active clock)
                </label>
              )}
              <div className="grid gap-2">
                <label className="font-medium">Note (optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="border-input bg-background flex w-full rounded-md border px-2 py-1.5 text-sm"
                  placeholder="e.g. deep cross-court"
                />
              </div>
              <Button type="button" className="w-full" disabled={busy} onClick={addShot}>
                Add shot at active clock
              </Button>
              {(createMut.error || updateMut.error || deleteMut.error) && (
                <p className="text-destructive text-xs">
                  {(createMut.error as Error)?.message ??
                    (updateMut.error as Error)?.message ??
                    (deleteMut.error as Error)?.message}
                </p>
              )}
            </CardContent>
          </Card>

          {!isYoutube && (
            <SuggestedShotsPanel
              videoId={videoId}
              processingStatus={v.processingStatus}
              seekTo={seekTo}
              onFocusChange={setFocusedSuggestion}
              disableShortcuts={reviewQueueActive}
              activeRallyId={activeRallyId}
              playerSlot={focusPlayerSlot}
            />
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Shots ({events.length})</CardTitle>
              <CardDescription>Sorted by time · click row to seek</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[min(60vh,520px)] space-y-2 overflow-y-auto text-sm">
              {eventsQ.isLoading && <p className="text-muted-foreground">Loading…</p>}
              {events.length === 0 && !eventsQ.isLoading && (
                <p className="text-muted-foreground">No shots yet. Use the form or keyboard shortcuts.</p>
              )}
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="hover:bg-muted/50 rounded-md border p-2 transition-colors"
                  role="button"
                  tabIndex={0}
                  onClick={() => seekTo(ev.timestampSeconds)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      seekTo(ev.timestampSeconds);
                    }
                  }}
                >
                  {editingId === ev.id ? (
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        step={0.1}
                        value={editTs}
                        onChange={(e) => setEditTs(Number(e.target.value))}
                        className="border-input flex h-8 w-full rounded border px-2 text-xs"
                      />
                      <div className="grid grid-cols-3 gap-1">
                        <select
                          value={editShotType}
                          onChange={(e) => setEditShotType(e.target.value as ShotEventDTO["shotType"])}
                          className="border-input rounded border px-1 text-xs"
                        >
                          {SHOT_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editSide}
                          onChange={(e) => setEditSide(e.target.value as ShotEventDTO["side"])}
                          className="border-input rounded border px-1 text-xs"
                        >
                          {SHOT_SIDES.map((s) => (
                            <option key={s} value={s}>
                              {sideLabel(s)}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editOutcome}
                          onChange={(e) => setEditOutcome(e.target.value as ShotEventDTO["outcome"])}
                          className="border-input rounded border px-1 text-xs"
                        >
                          {SHOT_OUTCOMES.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-muted-foreground text-xs">Player: {meDisplayName(players)} (player_1)</p>
                      <select
                        value={editRallyId ?? ""}
                        onChange={(e) =>
                          setEditRallyId(e.target.value === "" ? null : e.target.value)
                        }
                        className="border-input w-full rounded border px-1 text-xs"
                      >
                        <option value="">No rally</option>
                        {rallies.map((r: VideoRallyDTO, i: number) => (
                          <option key={r.id} value={r.id}>
                            Rally #{i + 1}
                            {r.endTimeSeconds == null ? " (open)" : ""}
                          </option>
                        ))}
                      </select>
                      {editRallyId && (
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={editEndsRally}
                            onChange={(e) => setEditEndsRally(e.target.checked)}
                          />
                          Ends rally
                        </label>
                      )}
                      <textarea
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        rows={2}
                        className="border-input w-full rounded border px-2 py-1 text-xs"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" type="button" disabled={busy} onClick={saveEdit}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{formatClock(ev.timestampSeconds)}</p>
                        <p className="font-medium">
                          {ev.shotType} · {sideLabel(ev.side)} · {ev.outcome}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {playerTag(ev.playerSlot, players) && (
                            <span>{playerTag(ev.playerSlot, players)} · </span>
                          )}
                          {ev.rallyId != null && (
                            <span>
                              Rally #{rallyIndexById.get(ev.rallyId) ?? "?"}
                              {ev.shotIndexInRally != null && ` · shot ${ev.shotIndexInRally}`}
                              {ev.endsRally && " · ends"}
                            </span>
                          )}
                        </p>
                        {ev.note && <p className="text-muted-foreground text-xs">{ev.note}</p>}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" variant="outline" type="button" onClick={(e) => { e.stopPropagation(); startEdit(ev); }}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          type="button"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Delete this shot?")) deleteMut.mutate(ev.id);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
