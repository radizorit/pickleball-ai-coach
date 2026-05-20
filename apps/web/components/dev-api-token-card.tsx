"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Dev-only helper: Clerk Next.js does not expose `window.Clerk`.
 * Use this to copy a session JWT into Swagger (`/docs` → Authorize).
 */
export function DevApiTokenCard() {
  const { getToken, isSignedIn } = useAuth();
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const copyToken = useCallback(async () => {
    setStatus("idle");
    setMessage(null);
    try {
      const token = await getToken();
      if (!token) {
        setStatus("error");
        setMessage("No token returned. Sign in again at /sign-in.");
        return;
      }
      await navigator.clipboard.writeText(token);
      setStatus("copied");
      setMessage("JWT copied. Paste into Swagger → Authorize → access-token.");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Could not get token");
    }
  }, [getToken]);

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">API token (dev)</CardTitle>
        <CardDescription>
          For Swagger at <code className="text-xs">localhost:4000/docs</code>. The web app adds this
          automatically; the API URL bar does not.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {!isSignedIn ? (
          <p className="text-muted-foreground">Sign in first, then copy your JWT.</p>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => void copyToken()}>
            Copy JWT for Swagger
          </Button>
        )}
        {status === "copied" && (
          <p className="text-primary text-xs">{message}</p>
        )}
        {status === "error" && message && (
          <p className="text-destructive text-xs">{message}</p>
        )}
      </CardContent>
    </Card>
  );
}
