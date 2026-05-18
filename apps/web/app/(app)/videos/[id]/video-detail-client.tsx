"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { ApiClientError } from "@/lib/api/client";
import { useAuthedApiClient } from "@/lib/api/use-authed-api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function VideoDetailClient({ videoId }: { videoId: string }) {
  const client = useAuthedApiClient();
  const q = useQuery({
    queryKey: ["videos", videoId],
    queryFn: () => client.videosGet(videoId),
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

  const v = q.data;
  if (!v) return null;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/videos">← All videos</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{v.title}</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">
          {v.processingStatus} · {v.privacy}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
          <CardDescription>
            IDs and storage fields (opaque until upload is configured).
          </CardDescription>
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
            <span className="text-foreground font-medium">Created:</span>{" "}
            {new Date(v.createdAt).toLocaleString()}
          </p>
          <p>
            <span className="text-foreground font-medium">Updated:</span>{" "}
            {new Date(v.updatedAt).toLocaleString()}
          </p>
          <p>
            <span className="text-foreground font-medium">Storage:</span> {v.storageProvider ?? "—"}{" "}
            / {v.storageBucket ?? "—"} / {v.storageObjectKey ?? "—"}
          </p>
          {v.failureMessage && (
            <p className="text-destructive">
              <span className="font-medium">Failure:</span> {v.failureMessage}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
