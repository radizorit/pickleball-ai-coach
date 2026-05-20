import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardMeCard } from "@/components/dashboard-me-card";
import { DevApiTokenCard } from "@/components/dev-api-token-card";

export default async function DashboardPage() {
  const user = await currentUser();
  const label =
    user?.firstName || user?.lastName
      ? [user.firstName, user.lastName].filter(Boolean).join(" ")
      : (user?.username ?? "there");

  return (
    <div className="space-y-8">
      <div>
        <p className="text-primary text-sm font-medium uppercase tracking-wider">Dashboard</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome back, {label}</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          You&apos;re signed in. The card below loads your canonical user row from Postgres through
          the Nest API — proof that Clerk JWT verification and idempotent sync are wired end-to-end.
        </p>
      </div>

      <DashboardMeCard />

      <DevApiTokenCard />

      <Card>
        <CardHeader>
          <CardTitle>What&apos;s next</CardTitle>
          <CardDescription>
            Organizations are still deferred — video records and upload scaffolding are available
            under Videos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/">Back to marketing site</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
