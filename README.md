# Pickleball Assistant

Production-grade pickleball video analytics SaaS. Upload your matches, tag
the shots, and get coaching feedback that tells you what to drill next.

This repo ships a **Clerk auth foundation** (web session + API JWT + DB user
sync) and a **video upload foundation**: authenticated users can create and
list video metadata rows via `/v1/videos`, upload to S3/R2, and a **polling
worker** (`apps/worker`) promotes rows to `ready` with metadata + a poster
JPEG. AI, billing, and organizations remain later phases. See [`ROADMAP.md`](ROADMAP.md)
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
  web/          Next.js — Clerk auth, marketing, `/dashboard`, `/videos`, webhooks
  api/          NestJS REST API (versioned at /v1, Swagger at /docs)
  worker/       Node worker — Postgres claim loop, ffprobe/ffmpeg, poster to R2/S3
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
                ↑          ↑
                web        worker
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

# 4. Apply SQL migrations (`external_auth_id`, video lifecycle columns, …)
pnpm db:migrate

# 5. (Optional) seed a local-only demo user (no Clerk id)
pnpm db:seed
```

## Authentication (Clerk)

1. Create a Clerk application and copy **Publishable** + **Secret** keys into
   `.env` (replace every `REPLACE_ME` placeholder — while placeholders remain,
   the Clerk UI stays disabled so `next build` / CI can run without dashboard
   keys). If you open `/videos` or `/dashboard` before keys are set, the app
   redirects to **`/setup`** with the same checklist; restart `pnpm dev` after
   editing `.env`.
2. In Clerk → **Sessions**, you may add the **`email`** claim to the session JWT
   (**Customize session token**) so the API can read email without an extra Clerk
   round-trip. If you skip this, the API still resolves email via Clerk’s Backend
   API using the token’s `sub` (slightly more latency on each authenticated request).
3. Add a webhook endpoint pointing to your deployed origin (or ngrok locally):
   `https://<your-host>/api/webhooks/clerk` subscribing to `user.created` and
   `user.updated`. Copy the **Signing secret** into `CLERK_WEBHOOK_SECRET`.
4. Sign in at `/sign-in`. The dashboard calls `GET /v1/me` with a Clerk JWT
   to verify end-to-end wiring.

`apps/api` verifies bearer tokens via `@clerk/backend` behind a small
`AuthPort` abstraction so swapping auth vendors later is localized.

## Video records (upload foundation)

- **Web:** `/videos`, `/videos/new` (create via **YouTube link** or **file upload** with progress),
  `/videos/:id` detail, **`/videos/:id/review`** (manual shot tagging, **heuristic suggested moments** on uploads, timeline + **rule-based coaching feedback** from tags).
- **YouTube link (quick testing):** On `/videos/new`, choose **YouTube link**, paste a watch URL
  (`youtube.com`, `youtu.be`, etc.). The API stores `youtubeUrl`, sets **`processingStatus` to
  `ready` immediately** (no S3 object, no worker job). The detail page uses an **embed** and
  `img.youtube.com` for the poster. There is **no signed `read-url` for source or thumbnail** for
  these rows (embed-only MVP). The API may **enrich the title** from YouTube’s oEmbed endpoint when
  you create the record.
- **File upload:** `POST /v1/videos` (no `youtubeUrl`) → `pending` → `POST …/presign` → browser PUT →
  `complete-upload` → `uploaded` → worker → `ready` (see below).
- **API:** `GET/POST /v1/videos`, `GET /v1/videos/:id`, `POST /v1/videos/:id/presign`,
  `POST /v1/videos/:id/complete-upload`, `GET /v1/videos/:id/read-url?asset=source|thumbnail`
  (signed GET for S3-backed media),
  **`GET/POST /v1/videos/:id/shot-events`**, **`PATCH/DELETE /v1/shot-events/:eventId`**
  (manual tags; ownership via `videos.user_id`) — all require a Clerk JWT. DTOs live in `@pickleball/shared`.
  **Suggested shots (upload path):** `GET /v1/videos/:id/suggested-shot-events` (optional `?status=`), **`PATCH /v1/suggested-shot-events/:id`** (`{ "status": "rejected" }` only),
  **`POST /v1/videos/:videoId/suggested-shot-events/:id/convert`** (creates a manual `shot_events` row and marks the suggestion accepted).
- **Upload flow:** `pending` → (presign) → `uploading` → (browser PUT to presigned URL) →
  `complete-upload` → `uploaded` (API verifies size via `HeadObject`) →
  **`processing` → `ready`** (worker: ffprobe + poster `poster.jpg`) or **`failed`**.
- **DB:** Drizzle migrations under `packages/db/drizzle/` (including `youtube_url`, **`shot_events`**). After pulling,
  run **`pnpm db:migrate`**.
- **Storage:** set `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_REGION` (AWS)
  or `S3_ENDPOINT` + region (R2) in the **repo root** `.env` for the API **and worker**
  (same file; `boot-env` loads it for both apps). If unset on the API, presign returns **503**
  (noop adapter). The **worker** exits at boot if those vars are missing — it needs S3 to upload posters.
  **YouTube-only videos do not require S3** for creation or playback.
- **AWS S3:** create a private bucket in your chosen region, then an IAM user with programmatic access
  and an inline policy granting `s3:GetObject`, `s3:PutObject`, and `s3:HeadObject` on `arn:aws:s3:::your-bucket/*`
  (add `s3:ListBucket` on the bucket ARN if you use console verification). Put the access key id and secret
  in `.env` as `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`. Match `S3_REGION` to the bucket region.
  Configure bucket **CORS** for `PUT` and `GET` from `http://localhost:3000` (see below).
- **Posters (upload path):** same bucket as the source file; object key `videos/<userId>/<videoId>/poster.jpg`
  stored on the row as `thumbnailObjectKey`.
- **R2 / S3 CORS:** allow `PUT` from your web origin on the bucket; for `<video>` / Range requests,
  allow `GET` from browser origins (or use a CDN origin later). Expose `ETag` if you need multipart.

## Suggested shots (heuristic v1)

1. **Detection:** After the worker downloads the upload, it runs **ffmpeg scene-change** detection (`select='gt(scene,T)'` + `showinfo`), parses `pts_time` from stderr, merges nearby hits (~0.35s), caps the list (~40), and maps scene strength to a **confidence** in `[0, 1]`. Failures are logged and **do not** fail the job.
2. **Storage:** Rows live in **`suggested_shot_events`** with `source` (e.g. `heuristic_v1`), `status` (`suggested` \| `accepted` \| `rejected`), and timestamps. On re-run, the worker deletes only **pending** heuristic rows for that video before inserting a fresh batch so dismissed/accepted history stays intact.
3. **Workflow:** Review UI lists pending suggestions → **Reject** (PATCH) or **Convert** (POST), which inserts a **`shot_events`** row (`source: manual`, note references the suggestion id) and sets the suggestion to **`accepted`**.
4. **Limits:** No shot classification or rally context in this slice; **camera cuts are not always shots**. **YouTube-linked videos** skip the heuristic (no local file in this pipeline) — the API returns an empty list for them.
5. **Future ML:** Replace or supplement `apps/worker/src/heuristic-suggested-shots.ts` with model inference writing the same table under a new `source` (and optional JSON `payload` column later).
6. **Next task ideas:** “Re-run suggestions” for already-`ready` uploads, an **audio-energy** heuristic pass, or a foreign key from `shot_events` to `suggested_shot_events.id` for audit.

## Local development

Run web + API concurrently with one command:

```bash
pnpm dev
```

This runs Turborepo in `--parallel` mode and starts:

- `@pickleball/web` on http://localhost:3000 (loads **repo root** `.env` via `apps/web/next.config.ts` so Clerk and URLs match the API)
- `@pickleball/api` on http://localhost:4000 (Swagger at /docs)

Run them individually if you prefer:

```bash
pnpm dev:web      # only the Next.js app
pnpm dev:api      # only the NestJS API
pnpm dev:worker   # video metadata + poster worker (needs ffmpeg/ffprobe + S3_*)
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

pnpm db:generate      # build @pickleball/shared + db, then generate SQL from dist/schema
pnpm db:migrate       # apply pending migrations
pnpm db:push          # build shared + db, then push schema (dev only — no migration file)
pnpm db:studio        # build shared + db, then open Drizzle Studio against DATABASE_URL
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
| Background worker    | 3     | `apps/worker` polls Postgres + FFmpeg/ffprobe; swap in a queue later. |
|                      |       | Redis/BullMQ optional for fan-out.                                  |
| Tagging studio       | 4     | Desktop/tablet-first video review UI under `(app)/videos`.          |
| Stats engine         | 5     | Restore `packages/shared/stats` with deterministic helpers.         |
| Feedback reports     | 6     | Restore `packages/shared/feedback` (rule-based) → LLM later.        |
| Billing              | 7     | Stripe checkout + webhooks + plan enforcement.                      |
| AI suggestions       | 9     | New `apps/ai-service` (Python), `ai_predictions` table.             |

Each of these has a deliberate slot in the layout above. Adding them does
not require moving anything; it only adds new directories and tables.
