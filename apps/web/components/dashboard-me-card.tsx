"use client";

import { useQuery } from "@tanstack/react-query";

import { ApiClientError } from "@/lib/api/client";
import { useAuthedApiClient } from "@/lib/api/use-authed-api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DashboardMeCard() {
  const client = useAuthedApiClient();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => client.me(),
  });

  const ping = useQuery({
    queryKey: ["me", "ping"],
    queryFn: () => client.mePing(),
  });

  if (me.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
          <CardDescription>Loading account from the API…</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted h-24 animate-pulse rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (me.error) {
    const err = me.error instanceof ApiClientError ? me.error : null;
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Could not load profile</CardTitle>
          <CardDescription>
            {err ? `${err.statusCode} · ${err.code}` : "Request failed"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          {err?.message ?? "Unknown error. Is the API running and is DATABASE_URL set?"}
        </CardContent>
      </Card>
    );
  }

  if (!me.data) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
          <CardDescription>
            Synced from Clerk via <code className="text-xs">GET /v1/me</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Email:</span> {me.data.email}
          </p>
          <p>
            <span className="text-muted-foreground">Name:</span> {me.data.name ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">User id (DB):</span>{" "}
            <code className="bg-muted rounded px-1 py-0.5 text-xs">{me.data.id}</code>
          </p>
          <p>
            <span className="text-muted-foreground">Clerk id:</span>{" "}
            <code className="bg-muted rounded px-1 py-0.5 text-xs">
              {me.data.externalAuthId ?? "—"}
            </code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Protected route check</CardTitle>
          <CardDescription>
            <code className="text-xs">GET /v1/me/ping</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {ping.isLoading && <p className="text-muted-foreground">Checking…</p>}
          {ping.error && (
            <p className="text-destructive">
              {ping.error instanceof ApiClientError ? ping.error.message : "Ping failed"}
            </p>
          )}
          {ping.data && (
            <p>
              <span className="text-muted-foreground">Clerk subject:</span>{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">
                {ping.data.externalAuthId}
              </code>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
