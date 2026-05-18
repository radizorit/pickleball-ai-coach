"use client";

import { useQuery } from "@tanstack/react-query";

import { api, ApiClientError } from "@/lib/api/client";

/**
 * Tiny end-to-end smoke widget on the landing page. Confirms the web app
 * can reach the NestJS API and that shared types serialize across the
 * network without runtime drift. Remove once we have a real authed home.
 */
export function ApiStatus() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["api", "health"],
    queryFn: () => api.health(),
    retry: 0,
  });

  if (isLoading) {
    return <Pill tone="muted">Checking API…</Pill>;
  }
  if (error) {
    const message =
      error instanceof ApiClientError ? `${error.statusCode} ${error.code}` : "unreachable";
    return <Pill tone="destructive">API: {message}</Pill>;
  }
  if (!data) return null;

  return (
    <Pill tone="success">
      API: {data.service} v{data.version} · {Math.round(data.uptimeSeconds)}s up
    </Pill>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "muted" | "success" | "destructive";
}) {
  const classes = {
    muted: "bg-muted text-muted-foreground",
    success: "bg-primary/10 text-primary",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${classes}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
