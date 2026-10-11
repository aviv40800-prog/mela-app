# syntax=docker/dockerfile:1
# Production image for MELA. Works on Railway, Render, Fly.io or any Docker host.
# Persistent data (SQLite + photos) goes to /data: mount a volume/disk there.

FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The build loads route modules, so keep its throwaway DB away from /data and skip seeding.
RUN MELA_DATA_DIR=/tmp/build-data MELA_SKIP_SEED=1 npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    MELA_DATA_DIR=/data
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 3000
# Runs as root so it can write to platform-mounted volumes (which are root-owned on Railway).
CMD ["node", "server.js"]
