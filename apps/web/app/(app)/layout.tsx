import Link from "next/link";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import { ThemeToggle } from "@/components/theme-toggle";
import { isClerkConfigured } from "@/lib/clerk-config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isClerkConfigured()) {
    redirect("/");
  }

  const session = await auth();
  if (!session.userId) {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border bg-background/70 sticky top-0 z-40 border-b backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
            <Link href="/dashboard" className="flex shrink-0 items-center gap-2 font-semibold">
              <span className="bg-primary inline-block h-6 w-6 rounded-md" />
              <span className="truncate">Pickleball Assistant</span>
            </Link>
            <nav className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <Link href="/dashboard" className="hover:text-foreground whitespace-nowrap">
                Dashboard
              </Link>
              <Link href="/videos" className="hover:text-foreground whitespace-nowrap">
                Videos
              </Link>
              <span
                className="cursor-not-allowed whitespace-nowrap opacity-50"
                title="Organizations are coming in a later phase"
              >
                Organization
              </span>
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>
      <main className="container flex-1 py-8">{children}</main>
    </div>
  );
}
