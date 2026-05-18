# Pickleball Assistant

Production-grade pickleball video analytics SaaS. Upload your matches, tag
the shots, and get coaching feedback that tells you what to drill next.

This repo ships a **Clerk auth foundation** (web session + API JWT + DB user
sync). Video upload, AI, billing, and organizations are still out of scope
for now — each is a deliberate next phase. See [`ROADMAP.md`](ROADMAP.md)
for the full sequence, and [`SPEC.md`](SPEC.md) +
[`ARCHITECTURE.md`](ARCHITECTURE.md) for the long form product and
architecture plans.

## Stack

| Layer           | Choice                                                                       |
| --------------- | ---------------------------------------------------------------------------- |
| Web             | Next.js 15 · Clerk · Tailwind · shadcn/ui · TanStack Query                   |
| API             | NestJS 10 · class-validator · `@nestjs/swagger` (OpenAPI at `/docs`)         |
| DB              | Postgres · Drizzle ORM (`@pickleball/db`)                                    |
| Shared          | `@pickleball/shared`: enums, zod schemas, DTOs (network-boundary safe)       |
| Tooling         | pnpm workspaces · Turborepo · ESLint flat config · Prettier · Vitest · Husky |
| Deploy (target) | Web → Vercel · API → Cloud Run / Fly / Render · DB → Neon / Supabase / RDS   |

## Layout

```text
apps/
  web/          Next.js — Clerk auth, marketing site, `/dashboard`, webhooks
  api/          NestJS REST API (versioned at /v1, Swagger at /docs)
  mobile/       Placeholder for the future Expo / React Native app
packages/
  shared/       Pure-TS types, zod schemas, enums. Imported by web + api + mobile.
  db/           Drizzle schema, client, migrations, seed.
  config/       Shared tsconfig + ESLint presets.
infra/
  docker/       docker-compose for local Postgres
.github/
  workflows/    CI: format / lint / typecheck / test
SPEC.md, ARCHITECTURE.md, ROADMAP.md
```

The dependency graph is strictly one-way:

```
config  ←  shared  ←  db
                ↑          ↑
                ╰── api  ──╯
                ↑
                web
```

`shared` never imports from `db` or any app — it is the cross-network
vocabulary so the future `apps/mobile` can adopt it without pulling in
Node / Drizzle / Next.

## Prerequisites

- Node 20.17+ (see `.nvmrc`)
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- Docker (only for local Postgres)

## First-time setup

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Copy env template and edit values you need
cp .env.example .env

# 3. Start local Postgres
pnpm docker:up

# 4. Apply SQL migrations (adds `external_auth_id`, etc.)
pnpm db:migrate

# 5. (Optional) seed a local-only demo user (no Clerk id)
pnpm db:seed
```

## Authentication (Clerk)

1. Create a Clerk application and copy **Publishable** + **Secret** keys into
   `.env` (replace every `REPLACE_ME` placeholder — while placeholders remain,
   the Clerk UI stays disabled so `next build` / CI can run without dashboard
   keys).
2. In Clerk → **Sessions**, ensure the session token includes the **`email`**
   claim (required by the Nest API to upsert `users.email`).
3. Add a webhook endpoint pointing to your deployed origin (or ngrok locally):
   `https://<your-host>/api/webhooks/clerk` subscribing to `user.created` and
   `user.updated`. Copy the **Signing secret** into `CLERK_WEBHOOK_SECRET`.
4. Sign in at `/sign-in`. The dashboard calls `GET /v1/me` with a Clerk JWT
   to verify end-to-end wiring.

`apps/api` verifies bearer tokens via `@clerk/backend` behind a small
`AuthPort` abstraction so swapping auth vendors later is localized.

## Local development

Run web + API concurrently with one command:

```bash
pnpm dev
```

This runs Turborepo in `--parallel` mode and starts:

- `@pickleball/web` on http://localhost:3000
- `@pickleball/api` on http://localhost:4000 (Swagger at /docs)

Run them individually if you prefer:

```bash
pnpm dev:web      # only the Next.js app
pnpm dev:api      # only the NestJS API
```

The web landing page has a small status pill that fetches `/v1/health` —
a green pill means web ↔ API ↔ shared types are wired correctly.

## Common commands

```bash
pnpm build            # build all packages and apps (turbo, respects graph)
pnpm lint             # eslint across the monorepo
pnpm typecheck        # tsc --noEmit everywhere
pnpm test             # vitest across every package
pnpm format           # prettier --write
pnpm format:check     # prettier --check (CI)

pnpm db:generate      # generate a new Drizzle migration from schema changes
pnpm db:migrate       # apply pending migrations
pnpm db:push          # push the schema directly (dev only — no migration file)
pnpm db:studio        # open Drizzle Studio against your DATABASE_URL
pnpm db:seed          # idempotent demo seed
```

## Adding a new package or app

1. Create the directory under `apps/` or `packages/`.
2. Give it a `package.json` named `@pickleball/<name>` and depend on
   `@pickleball/config` for tsconfig + eslint presets.
3. Run `pnpm install` at the root — pnpm-workspace picks it up via the
   `apps/*` and `packages/*` globs.
4. If it has a `dev`, `build`, `lint`, `typecheck`, or `test` script,
   `turbo` will automatically include it.

## Recommended local workflow

1. `pnpm docker:up` once per day (Postgres).
2. `pnpm dev` keeps web + API hot-reloading in parallel.
3. Edit `packages/shared` for any change that crosses the network — both
   apps pick the change up via `transpilePackages` (web) and `tsx watch`
   (api) without rebuilds.
4. When you change DB schema in `packages/db/src/schema/*`:
   - `pnpm db:push` for fast local iteration, OR
   - `pnpm db:generate` then commit the new `drizzle/` SQL file for prod.
5. Open a PR; CI re-runs format / lint / typecheck / test.

## What is NOT in the foundation (and where it will land)

| Feature              | Phase | Notes                                                               |
| -------------------- | ----- | ------------------------------------------------------------------- |
| Organizations / RBAC | 2+    | Tables exist; provisioning, invites, and role enforcement are next. |
| Video upload         | 2     | Direct-to-S3 multipart from the browser, signed URLs from           |
|                      |       | the API. New `upload_sessions` table + R2/S3 service.               |
| Background worker    | 3     | New `apps/worker` with BullMQ + Redis + FFmpeg for                  |
|                      |       | thumbnails, preview clips, metadata extraction.                     |
| Tagging studio       | 4     | Desktop/tablet-first video review UI under `(app)/videos`.          |
| Stats engine         | 5     | Restore `packages/shared/stats` with deterministic helpers.         |
| Feedback reports     | 6     | Restore `packages/shared/feedback` (rule-based) → LLM later.        |
| Billing              | 7     | Stripe checkout + webhooks + plan enforcement.                      |
| AI suggestions       | 9     | New `apps/ai-service` (Python), `ai_predictions` table.             |

Each of these has a deliberate slot in the layout above. Adding them does
not require moving anything; it only adds new directories and tables.
