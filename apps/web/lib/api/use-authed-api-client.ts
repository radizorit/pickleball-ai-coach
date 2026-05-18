"use client";

import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";

import { createApiClient } from "@/lib/api/client";

/**
 * Memoized API client that attaches the Clerk session JWT to each request.
 */
export function useAuthedApiClient() {
  const { getToken } = useAuth();
  return useMemo(() => createApiClient({ getToken }), [getToken]);
}
