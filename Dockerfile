# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# Bun version is pinned here, in .github/workflows/ci.yml, and in
# docker-compose.yml so local dev, CI and Docker builds all use the same
# runtime. When bumping, update all three plus .env.example.
ARG BUN_VERSION=1.3.3

# Public base URL used by the client bundle for absolute canonical / og URLs.
# Passed in at build time (docker-compose.yml sets build.args from
# PUBLIC_BASE_URL) so Vite can bake it into the JS.
ARG VITE_PUBLIC_BASE_URL=https://nahundfern.servuswir.de
ENV VITE_PUBLIC_BASE_URL=$VITE_PUBLIC_BASE_URL

# Kartenstil (Vektor-Kacheln) für die Weltkarte. Muss zur Build-Zeit gesetzt
# sein, weil Vite VITE_*-Variablen ins Client-Bundle backt.
ARG VITE_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty
ENV VITE_MAP_STYLE_URL=$VITE_MAP_STYLE_URL

RUN apk add --no-cache libc6-compat vips-dev python3 make g++ \
    && corepack enable

# install deps (use bun if lockfile is bun.lock, else npm)
COPY package.json bun.lock* package-lock.json* ./
RUN if [ -f bun.lock ]; then \
      npm install -g bun@${BUN_VERSION} && bun install --frozen-lockfile ; \
    else \
      npm ci ; \
    fi

COPY . .
ENV NODE_ENV=production
ENV NITRO_PRESET=node-server
# Der Produktivserver hat 2 GB RAM plus Swap. Eine höhere Grenze führt dort
# zum SIGKILL durch das Betriebssystem, bevor Node den Build abschließen kann.
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN if [ -f bun.lock ]; then bun run build ; else npm run build ; fi

# ---------- runtime stage ----------
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache vips tini ffmpeg \
    && addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=app:app /app/.output ./.output
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/db ./db
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/src/assets ./src/assets

RUN mkdir -p /app/uploads/originals /app/uploads/webp /app/uploads/avif \
      /app/uploads/videos/originals /app/uploads/videos/mp4 /app/uploads/videos/poster \
    && chown -R app:app /app/uploads

USER app
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "scripts/start.sh"]
