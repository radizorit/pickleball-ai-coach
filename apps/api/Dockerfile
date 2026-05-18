# syntax=docker/dockerfile:1.7
#
# Production image for @pickleball/api. Multi-stage build:
#   1. install all workspace deps + build the API and its workspace dep tree
#   2. ship a slim image with prod-only deps + compiled JS
#
# Build from the monorepo root:
#   docker build -f apps/api/Dockerfile -t pickleball-api .

ARG NODE_VERSION=20.17.0

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS build
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @pickleball/shared build \
 && pnpm --filter @pickleball/db build \
 && pnpm --filter @pickleball/api build
# Re-install with prod-only deps in a clean dir we can copy out.
RUN pnpm --filter @pickleball/api... deploy --prod /out

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./dist
EXPOSE 4000
CMD ["node", "dist/main.js"]
