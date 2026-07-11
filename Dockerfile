# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

RUN apk add --no-cache libc6-compat vips-dev python3 make g++ \
    && corepack enable

# install deps (use bun if lockfile is bun.lock, else npm)
COPY package.json bun.lock* package-lock.json* ./
RUN if [ -f bun.lock ]; then \
      npm i -g bun && bun install --frozen-lockfile ; \
    else \
      npm ci ; \
    fi

COPY . .
ENV NODE_ENV=production
ENV NITRO_PRESET=node-server
RUN if [ -f bun.lock ]; then bun run build ; else npm run build ; fi

# ---------- runtime stage ----------
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache vips tini \
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
    && chown -R app:app /app/uploads

USER app
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "scripts/start.sh"]
