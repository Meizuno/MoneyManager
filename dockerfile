FROM node:20-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
# Placeholder URL so `prisma generate` can validate the schema without a real DB
ENV NUXT_DATABASE_URL="postgresql://x:x@x:5432/x"
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Strip devDependencies so the runner only carries what's needed at
# runtime: nuxt's `.output` server, @prisma/client, the prisma CLI
# (for migrate deploy at startup), and the runtime libs.
RUN pnpm prune --prod

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

EXPOSE 3000

# Container readiness probe — orchestrators (Docker, Compose, Swarm,
# k8s) wait for `healthy` before routing traffic.
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
