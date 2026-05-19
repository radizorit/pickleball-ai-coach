import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { isClerkConfigured } from "@/lib/clerk-config";

const isPublicRoute = createRouteMatcher([
  "/",
  "/setup",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/healthz",
  "/api/webhooks/clerk(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isClerkConfigured()) {
    return;
  }
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
