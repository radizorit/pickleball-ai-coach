"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * App-wide TanStack Query provider. Created with `useState` so each request
 * (during SSR) and each browser tab gets its own client — avoids sharing a
 * client across users in a multi-tenant deployment.
 *
 * Defaults are conservative: no auto-refetch on window focus, 30s staleness,
 * and one retry. Tune per-query when needed.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
