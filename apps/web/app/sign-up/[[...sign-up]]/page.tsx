import { SignUp } from "@clerk/nextjs";

import { isClerkConfigured } from "@/lib/clerk-config";

export default function SignUpPage() {
  if (!isClerkConfigured()) {
    return (
      <div className="container max-w-lg py-20 text-center">
        <h1 className="text-2xl font-semibold">Clerk is not configured</h1>
        <p className="text-muted-foreground mt-3">
          Replace placeholder Clerk keys in <code className="bg-muted rounded px-1">.env</code> with
          real values from the Clerk dashboard, then restart the dev server.
        </p>
      </div>
    );
  }

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg border border-border bg-card",
          },
        }}
      />
    </div>
  );
}
