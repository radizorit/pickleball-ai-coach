import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isClerkConfigured } from "@/lib/clerk-config";

export const metadata: Metadata = {
  title: "Configure Clerk",
  description: "Finish local auth setup so dashboard and videos routes work.",
};

export default function SetupPage() {
  const clerkOk = isClerkConfigured();

  return (
    <div className="container max-w-2xl py-16">
      <Card>
        <CardHeader>
          <CardTitle>{clerkOk ? "Clerk is configured" : "Clerk is not configured yet"}</CardTitle>
          <CardDescription>
            {clerkOk
              ? "Sign in to use the app shell (dashboard, videos, and API calls with a JWT)."
              : "App routes like /videos and /dashboard need real Clerk keys in the repo root .env."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-6 text-sm">
          {!clerkOk ? (
            <>
              <ol className="list-decimal space-y-3 pl-5">
                <li>
                  Copy <code className="text-foreground">.env.example</code> to{" "}
                  <code className="text-foreground">.env</code> at the monorepo root if you have not
                  already.
                </li>
                <li>
                  In the{" "}
                  <a
                    className="text-primary font-medium underline underline-offset-4"
                    href="https://dashboard.clerk.com"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Clerk dashboard
                  </a>
                  , open your application → <strong>API Keys</strong>.
                </li>
                <li>
                  Set in <code className="text-foreground">.env</code> (no <code>REPLACE_ME</code>{" "}
                  substring):
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>
                      <code className="text-foreground">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> — must
                      start with <code className="text-foreground">pk_test_</code> or{" "}
                      <code className="text-foreground">pk_live_</code>
                    </li>
                    <li>
                      <code className="text-foreground">CLERK_SECRET_KEY</code> — starts with{" "}
                      <code className="text-foreground">sk_</code>
                    </li>
                  </ul>
                </li>
                <li>
                  Restart the dev server (<code className="text-foreground">pnpm dev</code>) so Next.js
                  picks up env changes.
                </li>
                <li>
                  Open <Link className="text-primary font-medium underline underline-offset-4" href="/sign-in">/sign-in</Link>, sign in, then try{" "}
                  <Link className="text-primary font-medium underline underline-offset-4" href="/videos">
                    /videos
                  </Link>
                  .
                </li>
              </ol>
            </>
          ) : (
            <p>
              Next:{" "}
              <Link className="text-primary font-medium underline underline-offset-4" href="/sign-in">
                Sign in
              </Link>
              , then visit{" "}
              <Link className="text-primary font-medium underline underline-offset-4" href="/dashboard">
                Dashboard
              </Link>{" "}
              or{" "}
              <Link className="text-primary font-medium underline underline-offset-4" href="/videos">
                Videos
              </Link>
              .
            </p>
          )}
          <p>
            <Link className="text-primary underline underline-offset-4" href="/">
              ← Home
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
