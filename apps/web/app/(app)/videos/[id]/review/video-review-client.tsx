"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiClientError } from "@/lib/api/client";
import { useAuthedApiClient } from "@/lib/api/use-authed-api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoCoachingFeedbackPanel } from "@/components/video-coaching-feedback-panel";
import { VideoShotStatsPanel } from "@/components/video-shot-stats-panel";
import type { ShotEventDTO, VideoDTO } from "@pickleball/shared";
import type { ShotSide } from "@pickleball/shared/constants";
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

  const [videoClock, setVideoClock] = useState(0);
  const [manualClock, setManualClock] = useState(0);
  const activeClock = isYoutube ? manualClock : videoClock;

  const [shotType, setShotType] = useState<ShotEventDTO["shotType"]>("unknown");
  const [side, setSide] = useState<ShotEventDTO["side"]>("unknown");
  const [outcome, setOutcome] = useState<ShotEventDTO["outcome"]>("unknown");
  const [note, setNote] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editShotType, setEditShotType] = useState<ShotEventDTO["shotType"]>("unknown");
  const [editSide, setEditSide] = useState<ShotEventDTO["side"]>("unknown");
  const [editOutcome, setEditOutcome] = useState<ShotEventDTO["outcome"]>("unknown");
  const [editNote, setEditNote] = useState("");
  const [editTs, setEditTs] = useState(0);

  const durationSeconds = v?.durationSeconds ?? null;
  const timelineMax = useMemo(() => {
    const events = eventsQ.data ?? [];
    const maxEv = events.reduce((m, e) => Math.max(m, e.timestampSeconds), 0);
    const base = durationSeconds && durationSeconds > 0 ? durationSeconds : maxEv;
    return Math.max(base || 1, 1);
  }, [durationSeconds, eventsQ.data]);

  const createMut = useMutation({
    mutationFn: (body: CreateShotEventBody) => client.videosShotEventsCreate(videoId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["videos", videoId, "shot-events"] });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateShotEventBody }) =>
      client.shotEventsUpdate(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["videos", videoId, "shot-events"] });
      setEditingId(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => client.shotEventsDelete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["videos", videoId, "shot-events"] });
    },
  });

  const addShot = useCallback(() => {
    const body: CreateShotEventBody = {
      timestampSeconds: activeClock,
      shotType,
      side,
      outcome,
      note: note.trim() === "" ? undefined : note.trim(),
    };
    createMut.mutate(body);
    setNote("");
  }, [activeClock, shotType, side, outcome, note, createMut]);

  const quickCreate = useCallback(
    (partial: Partial<Pick<CreateShotEventBody, "shotType" | "side" | "outcome">>) => {
      const body: CreateShotEventBody = {
        timestampSeconds: activeClock,
        shotType: partial.shotType ?? "unknown",
        side: partial.side ?? "unknown",
        outcome: partial.outcome ?? "unknown",
      };
      createMut.mutate(body);
    },
    [activeClock, createMut],
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
  }, [editingId, isYoutube, quickCreate]);

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
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingId) return;
    const body: UpdateShotEventBody = {
      timestampSeconds: editTs,
      shotType: editShotType,
      side: editSide,
      outcome: editOutcome,
      note: editNote.trim() === "" ? null : editNote.trim(),
    };
    updateMut.mutate({ id: editingId, body });
  }, [editingId, editTs, editShotType, editSide, editOutcome, editNote, updateMut]);

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

  const events = eventsQ.data ?? [];
  const busy = createMut.isPending || updateMut.isPending || deleteMut.isPending;

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
      </div>

      <VideoShotStatsPanel videoId={videoId} events={eventsQ.data} isLoading={eventsQ.isLoading} />

      <VideoCoachingFeedbackPanel events={eventsQ.data} isLoading={eventsQ.isLoading} />

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
            <div className="relative mt-2 h-3 w-full rounded-full bg-muted">
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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tagging</CardTitle>
              <CardDescription>Active clock: {formatClock(activeClock)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
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
