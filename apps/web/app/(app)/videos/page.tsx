"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { ApiClientError } from "@/lib/api/client";
import { useAuthedApiClient } from "@/lib/api/use-authed-api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function VideosPage() {
  const client = useAuthedApiClient();
  const q = useQuery({
    queryKey: ["videos"],
    queryFn: () => client.videosList(),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-muted h-8 w-48 animate-pulse rounded-md" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-muted h-32 animate-pulse rounded-lg" />
          <div className="bg-muted h-32 animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  if (q.error) {
    const err = q.error instanceof ApiClientError ? q.error : null;
    return (
      <Card className="border-destructive/50 max-w-lg">
        <CardHeader>
          <CardTitle className="text-destructive">Could not load videos</CardTitle>
          <CardDescription>
            {err ? `${err.statusCode} · ${err.code}` : "Request failed"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          {err?.message ?? "Unknown error. Is the API running with DATABASE_URL?"}
        </CardContent>
      </Card>
    );
  }

  const items = q.data ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-primary text-sm font-medium uppercase tracking-wider">Videos</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Your library</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm sm:text-base">
            Create a record for each match you plan to upload. Object storage and transcoding are
            wired next — for now this is metadata only.
          </p>
        </div>
        <Button asChild className="shrink-0 self-start sm:self-auto">
          <Link href="/videos/new">New video</Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>No videos yet</CardTitle>
            <CardDescription>
              Start by creating a video record. File upload to cloud storage comes in the next
              phase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/videos/new">Create your first video</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((v) => (
            <li key={v.id}>
              <Link href={`/videos/${v.id}`}>
                <Card className="hover:border-primary/40 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="line-clamp-2 text-lg">{v.title}</CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {v.processingStatus} · {v.privacy}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-xs">
                    Updated {new Date(v.updatedAt).toLocaleString()}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
