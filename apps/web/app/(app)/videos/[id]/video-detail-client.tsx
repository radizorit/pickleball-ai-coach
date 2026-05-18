"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { ApiClientError } from "@/lib/api/client";
import { useAuthedApiClient } from "@/lib/api/use-authed-api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { VideoDTO } from "@pickleball/shared";

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}


function canRequestSourceRead(status: VideoDTO["processingStatus"]): boolean {
  return status === "uploaded" || status === "processing" || status === "ready" || status === "failed";
}

function statusPanel(status: VideoDTO["processingStatus"]): { title: string; tone: "muted" | "warn" | "info" | "ok" | "bad" } {
  switch (status) {
    case "pending":
      return { title: "Pending — create a presigned upload to begin.", tone: "warn" };
    case "uploading":
      return { title: "Uploading — finish the browser upload, then complete upload.", tone: "info" };
    case "uploaded":
      return { title: "Uploaded — waiting for background processing.", tone: "info" };
    case "processing":
      return { title: "Processing — extracting metadata and poster.", tone: "info" };
    case "ready":
      return { title: "Ready — metadata and poster are available.", tone: "ok" };
    case "failed":
      return { title: "Failed — see error below. Original file may still be playable.", tone: "bad" };
    default:
      return { title: status, tone: "muted" };
  }
}

function toneClasses(tone: ReturnType<typeof statusPanel>["tone"]): string {
  switch (tone) {
    case "warn":
      return "border-amber-500/40 bg-amber-500/5";
    case "info":
      return "border-blue-500/40 bg-blue-500/5";
    case "ok":
      return "border-emerald-500/40 bg-emerald-500/5";
    case "bad":
      return "border-destructive/50 bg-destructive/5";
    default:
      return "border-border";
  }
}

export function VideoDetailClient({ videoId }: { videoId: string }) {
  const client = useAuthedApiClient();
  const q = useQuery({
    queryKey: ["videos", videoId],
    queryFn: () => client.videosGet(videoId),
  });

  const v = q.data;
  const sourceEnabled = Boolean(v && canRequestSourceRead(v.processingStatus));
  const thumbEnabled = Boolean(v && v.processingStatus === "ready");

  const sourceRead = useQuery({
    queryKey: ["videos", videoId, "read-url", "source"],
    queryFn: () => client.videosReadUrl(videoId, "source"),
    enabled: sourceEnabled && q.isSuccess,
    staleTime: 120_000,
  });

  const thumbRead = useQuery({
    queryKey: ["videos", videoId, "read-url", "thumbnail"],
    queryFn: () => client.videosReadUrl(videoId, "thumbnail"),
    enabled: thumbEnabled && q.isSuccess,
    staleTime: 120_000,
  });

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-muted h-8 w-64 animate-pulse rounded-md" />
        <div className="bg-muted h-40 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (q.error) {
    const err = q.error instanceof ApiClientError ? q.error : null;
    return (
      <Card className="border-destructive/50 max-w-lg">
        <CardHeader>
          <CardTitle className="text-destructive">Could not load video</CardTitle>
          <CardDescription>
            {err ? `${err.statusCode} · ${err.code}` : "Request failed"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">{err?.message ?? "Unknown error"}</p>
          <Button variant="outline" asChild>
            <Link href="/videos">Back to list</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!v) return null;

  const panel = statusPanel(v.processingStatus);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/videos">← All videos</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{v.title}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          <span className="text-foreground font-medium">Privacy:</span> {v.privacy}
        </p>
      </div>

      <Card className={toneClasses(panel.tone)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Processing status</CardTitle>
          <CardDescription className="text-foreground/90">{panel.title}</CardDescription>
        </CardHeader>
        {v.failureMessage && (
          <CardContent className="pt-0">
            <p className="text-destructive text-sm">
              <span className="font-medium">Error:</span> {v.failureMessage}
            </p>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Playback</CardTitle>
          <CardDescription>
            Video and poster are loaded via short-lived signed URLs from the API. Raw storage keys are
            not used as media URLs in the browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {thumbEnabled && thumbRead.isLoading && (
            <p className="text-muted-foreground text-sm">Loading poster…</p>
          )}
          {thumbEnabled && thumbRead.data && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Poster</p>
              <img
                src={thumbRead.data.url}
                alt=""
                className="bg-muted max-h-64 w-full max-w-xl rounded-lg border object-contain"
              />
            </div>
          )}
          {thumbEnabled && thumbRead.error && (
            <p className="text-destructive text-sm">
              Could not load poster:{" "}
              {thumbRead.error instanceof ApiClientError ? thumbRead.error.message : "Unknown error"}
            </p>
          )}

          {sourceEnabled && sourceRead.isLoading && (
            <p className="text-muted-foreground text-sm">Loading video…</p>
          )}
          {sourceEnabled && sourceRead.data && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Video</p>
              <video
                key={sourceRead.data.url}
                controls
                playsInline
                preload="metadata"
                className="bg-muted max-w-3xl rounded-lg border"
                src={sourceRead.data.url}
              />
            </div>
          )}
          {sourceEnabled && sourceRead.error && (
            <p className="text-destructive text-sm">
              Could not load video URL:{" "}
              {sourceRead.error instanceof ApiClientError ? sourceRead.error.message : "Unknown error"}
              {sourceRead.error instanceof ApiClientError && sourceRead.error.statusCode === 503
                ? " (Is object storage configured on the API?)"
                : null}
            </p>
          )}

          {!sourceEnabled && (
            <p className="text-muted-foreground text-sm">
              Playback unlocks after the file is uploaded to storage (status becomes{" "}
              <code className="bg-muted rounded px-1 text-xs">uploaded</code> or later).
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
          <CardDescription>Technical details from the API (not raw storage paths).</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            <span className="text-foreground font-medium">Video id:</span>{" "}
            <code className="bg-muted rounded px-1 py-0.5 text-xs">{v.id}</code>
          </p>
          {v.description && (
            <p>
              <span className="text-foreground font-medium">Description:</span> {v.description}
            </p>
          )}
          <p>
            <span className="text-foreground font-medium">Lifecycle:</span> {v.processingStatus}
          </p>
          <p>
            <span className="text-foreground font-medium">Duration:</span> {formatDuration(v.durationSeconds)}
          </p>
          <p>
            <span className="text-foreground font-medium">Frame rate:</span>{" "}
            {v.fps != null ? `${v.fps} fps` : "—"}
          </p>
          <p>
            <span className="text-foreground font-medium">Resolution:</span>{" "}
            {v.width != null && v.height != null ? `${v.width}×${v.height}` : "—"}
          </p>
          <p>
            <span className="text-foreground font-medium">Declared upload size:</span> {formatBytes(v.fileSizeBytes)}
          </p>
          <p>
            <span className="text-foreground font-medium">Original filename:</span> {v.originalFilename ?? "—"}
          </p>
          <p>
            <span className="text-foreground font-medium">MIME type:</span> {v.contentType ?? "—"}
          </p>
          <p>
            <span className="text-foreground font-medium">Created:</span> {new Date(v.createdAt).toLocaleString()}
          </p>
          <p>
            <span className="text-foreground font-medium">Updated:</span> {new Date(v.updatedAt).toLocaleString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
