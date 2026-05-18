"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-destructive text-sm font-medium uppercase tracking-wider">
        Something went wrong
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t load this page</h1>
      <p className="text-muted-foreground max-w-md">
        {error.message || "An unexpected error occurred. Try again, or sign out and back in."}
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
