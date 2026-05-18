"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { ApiClientError } from "@/lib/api/client";
import { useAuthedApiClient } from "@/lib/api/use-authed-api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACCEPTED_VIDEO_MIME_TYPES,
  DEFAULT_MAX_VIDEO_UPLOAD_BYTES,
} from "@pickleball/shared/constants";
import type { VideoPrivacy } from "@pickleball/shared/constants";
import type { CreateVideoBody } from "@pickleball/shared/zod";

const privacyOptions: VideoPrivacy[] = ["private", "unlisted", "shared"];

const acceptedMimeSet = new Set<string>(ACCEPTED_VIDEO_MIME_TYPES);

function putFileWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        onProgress(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export default function NewVideoPage() {
  const client = useAuthedApiClient();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<VideoPrivacy>("private");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<
    "idle" | "creating" | "presigning" | "uploading" | "completing"
  >("idle");
  const [uploadPct, setUploadPct] = useState(0);

  const busy = phase !== "idle";

  const onPickFile = useCallback((f: File | null) => {
    setError(null);
    setFile(f);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose a video file to upload.");
      return;
    }
    if (!acceptedMimeSet.has(file.type)) {
      setError(`Unsupported file type: ${file.type || "unknown"}`);
      return;
    }
    if (file.size <= 0 || file.size > DEFAULT_MAX_VIDEO_UPLOAD_BYTES) {
      setError(`File must be between 1 byte and ${DEFAULT_MAX_VIDEO_UPLOAD_BYTES} bytes.`);
      return;
    }

    try {
      setPhase("creating");
      const body: CreateVideoBody = {
        title: title.trim(),
        ...(description.trim() !== "" ? { description: description.trim() } : {}),
        privacy,
      };
      const created = await client.videosCreate(body);

      setPhase("presigning");
      const presigned = await client.videosPresignUpload(created.id, {
        contentType: file.type as (typeof ACCEPTED_VIDEO_MIME_TYPES)[number],
        fileSizeBytes: file.size,
        originalFilename: file.name,
      });

      setPhase("uploading");
      setUploadPct(0);
      await putFileWithProgress(
        presigned.upload.url,
        file,
        presigned.upload.requiredHeaders,
        setUploadPct,
      );

      setPhase("completing");
      await client.videosCompleteUpload(created.id);
      router.push(`/videos/${created.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(`${err.statusCode} · ${err.code}: ${err.message}`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setPhase("idle");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/videos">← Back to videos</Link>
        </Button>
        <p className="text-primary text-sm font-medium uppercase tracking-wider">New video</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Upload a video</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Creates a DB record, then uploads directly to S3-compatible storage (R2 or AWS) using a
          presigned URL. Configure API S3_* env vars first.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details & file</CardTitle>
          <CardDescription>Title is required. Pick one video file.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                Title <span className="text-destructive">*</span>
              </label>
              <input
                id="title"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
                placeholder="e.g. Open play — Court 3"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="description"
                maxLength={5000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
                rows={3}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="privacy" className="text-sm font-medium">
                Privacy
              </label>
              <select
                id="privacy"
                value={privacy}
                disabled={busy}
                onChange={(e) => setPrivacy(e.target.value as VideoPrivacy)}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {privacyOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="file" className="text-sm font-medium">
                Video file <span className="text-destructive">*</span>
              </label>
              <input
                id="file"
                type="file"
                accept={ACCEPTED_VIDEO_MIME_TYPES.join(",")}
                disabled={busy}
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                className="text-muted-foreground file:bg-secondary text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
              {file && (
                <p className="text-muted-foreground text-xs">
                  {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MiB · {file.type}
                </p>
              )}
            </div>

            {phase === "uploading" && (
              <div className="space-y-1">
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>Uploading to object storage…</span>
                  <span>{uploadPct}%</span>
                </div>
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-2 transition-all duration-150"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
              </div>
            )}

            {busy && phase !== "uploading" && (
              <p className="text-muted-foreground text-sm">
                {phase === "creating" && "Creating video record…"}
                {phase === "presigning" && "Requesting presigned URL…"}
                {phase === "completing" && "Finalizing upload…"}
              </p>
            )}

            {error && <p className="text-destructive text-sm">{error}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Working…" : "Create & upload"}
              </Button>
              <Button type="button" variant="outline" asChild disabled={busy}>
                <Link href="/videos">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
