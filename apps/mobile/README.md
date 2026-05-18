# `apps/mobile` (placeholder)

This directory is reserved for the future React Native / Expo app. Per
the product roadmap we intentionally do not start it until the web app
has reached product-market fit (Phase 5).

When the time comes, scaffold it here:

```bash
pnpm create expo-app apps/mobile -- --template
```

The mobile app will reuse:

- `@pickleball/shared` for DTOs, enums, and zod validators (already
  network-boundary-safe — no Node, no Drizzle, no React imports).
- The generated OpenAPI client (next step) so HTTP calls are typed
  identically to the web app.

Do NOT add a `package.json` here yet — the `pnpm-workspace.yaml` glob
already includes `apps/*`, so the moment a real `package.json` lands
pnpm will pick it up.
