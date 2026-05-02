# SENTINEL-X Production Dockerfile
# Multi-stage build, security-hardened
FROM node:20-slim AS builder

WORKDIR /app

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Production
FROM node:20-slim AS production

WORKDIR /app

# Security: Non-root user
RUN groupadd -g 1000 appgroup && useradd -u 1000 -g appgroup -s /bin/sh appuser

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public 2>/dev/null || true
COPY --from=builder /app/convex ./convex

ENV NODE_ENV=production
ENV CONVEX_DEPLOY_KEY=${CONVEX_DEPLOY_KEY}

# Security
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["bun", "run", "dev"]