"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiClientError } from "@/lib/api/client";
import { useAuthedApiClient } from "@/lib/api/use-authed-api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { VideoPrivacy } from "@pickleball/shared/constants";
import type { CreateVideoBody } from "@pickleball/shared/zod";

const privacyOptions: VideoPrivacy[] = ["private", "unlisted", "shared"];

export default function NewVideoPage() {
  const client = useAuthedApiClient();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<VideoPrivacy>("private");
  const [originalFilename, setOriginalFilename] = useState("");
  const [contentType, setContentType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: CreateVideoBody = {
        title: title.trim(),
        ...(description.trim() !== "" ? { description: description.trim() } : {}),
        privacy,
        ...(originalFilename.trim() !== "" ? { originalFilename: originalFilename.trim() } : {}),
        ...(contentType.trim() !== ""
          ? { contentType: contentType.trim() as NonNullable<CreateVideoBody["contentType"]> }
          : {}),
      };
      const created = await client.videosCreate(body);
      router.push(`/videos/${created.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(`${err.statusCode} · ${err.code}: ${err.message}`);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/videos">← Back to videos</Link>
        </Button>
        <p className="text-primary text-sm font-medium uppercase tracking-wider">New video</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Create a video record
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Metadata only for now — upload URLs and processing will connect here later.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Required fields are marked.</CardDescription>
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
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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
                rows={3}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="privacy" className="text-sm font-medium">
                Privacy
              </label>
              <select
                id="privacy"
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value as VideoPrivacy)}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {privacyOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="filename" className="text-sm font-medium">
                Original filename (optional)
              </label>
              <input
                id="filename"
                maxLength={512}
                value={originalFilename}
                onChange={(e) => setOriginalFilename(e.target.value)}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                placeholder="match.mp4"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="mime" className="text-sm font-medium">
                Content type (optional)
              </label>
              <select
                id="mime"
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <option value="">Not specified</option>
                <option value="video/mp4">video/mp4</option>
                <option value="video/quicktime">video/quicktime</option>
                <option value="video/x-matroska">video/x-matroska</option>
                <option value="video/webm">video/webm</option>
              </select>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create video"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/videos">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
