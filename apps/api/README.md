# `@pickleball/api`

NestJS REST API for the Pickleball Assistant platform.

## Endpoints

- `GET /v1/health` — liveness + version + uptime. Used by the web app's
  landing-page status pill and by platform health checks.
- `GET /v1/videos`, `GET /v1/videos/:id` — stubbed (501 Not Implemented).
  Will land with Phase 2 (upload).
- `GET /docs` — interactive Swagger UI.
- `GET /docs-json` — raw OpenAPI document (consumed by future codegen).

## Local dev

```bash
# From the monorepo root:
pnpm install
cp .env.example .env  # fill in CORS_ORIGINS at minimum
pnpm --filter @pickleball/api dev
```

`tsx watch` recompiles on every save. The API listens on `:4000` by default;
override with `PORT`.

## Why NestJS

- Decorator-driven controllers map 1:1 to OpenAPI via `@nestjs/swagger`,
  giving us a generated, typed SDK in the next step.
- `class-validator` + `class-transformer` make DTO validation declarative
  and consistent. We pair them with Zod for parsing data crossing the
  network boundary (request bodies, query params).
- Module system keeps feature code (`modules/videos/`, `modules/health/`)
  isolated from cross-cutting concerns (filters, guards, interceptors in
  `common/`).

## Production

Build the Docker image from the monorepo root:

```bash
docker build -f apps/api/Dockerfile -t pickleball-api .
docker run --rm -p 4000:4000 -e CORS_ORIGINS=https://app.example.com pickleball-api
```

The image is multi-stage: deps + build in one stage, slim Node Alpine
runtime in the next, ~80 MB compressed.
