"use client";

import { ClerkProvider } from "@clerk/nextjs";

import { QueryAuthSync } from "@/components/query-auth-sync";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/lib/query/provider";
import { isClerkConfigured } from "@/lib/clerk-config";

export function AppProviders({
  children,
  publishableKey,
}: {
  children: React.ReactNode;
  publishableKey: string;
}) {
  const clerkOn = isClerkConfigured();

  const inner = (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryProvider>
        {clerkOn ? <QueryAuthSync /> : null}
        {children}
      </QueryProvider>
    </ThemeProvider>
  );

  if (!clerkOn) {
    return inner;
  }

  return <ClerkProvider publishableKey={publishableKey}>{inner}</ClerkProvider>;
}
