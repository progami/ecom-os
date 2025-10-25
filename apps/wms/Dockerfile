# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS build
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ecom-os/wms... build
RUN pnpm deploy --filter @ecom-os/wms --prod --out-dir /app

FROM node:20-bookworm-slim AS runner
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY --from=build /app ./
COPY docker/entrypoint-wms.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
ENTRYPOINT ["dumb-init", "--", "/entrypoint.sh"]
CMD ["node", "server.js"]
