"use client";

import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

/**
 * Clears TanStack Query cache when the Clerk session ends so in-flight or
 * scheduled refetches do not keep hitting protected API routes after sign-out.
 */
export function QueryAuthSync() {
  const { userId, isLoaded } = useAuth();
  const qc = useQueryClient();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (userId) {
      wasSignedIn.current = true;
      return;
    }
    if (wasSignedIn.current) {
      qc.clear();
      wasSignedIn.current = false;
    }
  }, [isLoaded, userId, qc]);

  return null;
}
