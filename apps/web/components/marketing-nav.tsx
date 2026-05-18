import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { isClerkConfigured } from "@/lib/clerk-config";

export function MarketingNav() {
  const clerkOn = isClerkConfigured();

  return (
    <nav className="flex items-center gap-2">
      <Link
        href="/#features"
        className="text-muted-foreground hover:text-foreground hidden text-sm sm:inline"
      >
        Features
      </Link>
      <ThemeToggle />
      {clerkOn ? (
        <>
          <SignedOut>
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">Get started</Link>
            </Button>
          </SignedOut>
          <SignedIn>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </>
      ) : (
        <>
          <Button asChild variant="ghost" size="sm" disabled title="Set real Clerk keys in .env">
            Sign in
          </Button>
          <Button asChild size="sm" disabled title="Set real Clerk keys in .env">
            Get started
          </Button>
        </>
      )}
    </nav>
  );
}
