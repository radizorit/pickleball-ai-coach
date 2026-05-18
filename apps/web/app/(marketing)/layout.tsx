import Link from "next/link";

import { MarketingNav } from "@/components/marketing-nav";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border bg-background/70 sticky top-0 z-40 border-b backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="bg-primary inline-block h-6 w-6 rounded-md" />
            Pickleball Assistant
          </Link>
          <MarketingNav />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-border border-t">
        <div className="text-muted-foreground container flex h-16 items-center justify-between text-sm">
          <p>© {new Date().getFullYear()} Pickleball Assistant</p>
          <p>Auth foundation · upload & AI coming next</p>
        </div>
      </footer>
    </div>
  );
}
