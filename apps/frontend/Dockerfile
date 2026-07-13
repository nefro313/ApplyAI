# syntax=docker/dockerfile:1.7
# Build with the repo root as context (needs the @applyai/types workspace):
#   docker build -f apps/frontend/Dockerfile -t applyai-frontend .

# Stage 1 — install the npm workspace (cached on lockfile)
FROM node:22-alpine AS deps
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/types/package.json packages/types/package.json

RUN --mount=type=cache,target=/root/.npm npm ci

# Stage 2 — build the standalone bundle
FROM node:22-alpine AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* are inlined at build time, so pass them as build args.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID

COPY --from=deps /repo/node_modules ./node_modules
COPY . .

RUN npm run build --workspace=applyai-frontend

# Stage 3 — minimal runner (standalone server, non-root)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=build --chown=nextjs:nodejs /repo/apps/frontend/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/frontend/public ./apps/frontend/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/frontend/server.js"]
