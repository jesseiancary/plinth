# syntax=docker/dockerfile:1

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Stage: base
# Base Node.js image with pnpm installed
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FROM node:24-alpine AS base

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Set working directory
WORKDIR /app

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Stage: dependencies
# Install all dependencies (production + dev)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FROM base AS dependencies

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all package.json files for workspace dependency resolution
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/validation/package.json ./packages/validation/

# Install all dependencies with frozen lockfile (exact versions)
RUN pnpm install --frozen-lockfile

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Stage: development
# Development stage with Vite HMR (Hot Module Replacement)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FROM dependencies AS development

# Copy source code (will be overridden by volume mount in docker-compose)
COPY apps/web ./apps/web/
COPY packages/types ./packages/types/
COPY packages/validation ./packages/validation/

# Expose Vite dev server port
EXPOSE 5173

# Set environment to development
ENV NODE_ENV=development

# Start Vite dev server with HMR
# Note: In docker-compose, this is overridden by volume mounts for live code updates
# Vite binds to 0.0.0.0 by default in Docker (via vite.config.ts)
CMD ["pnpm", "--filter", "web", "dev"]

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Stage: build
# Build optimized production static files with Vite
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FROM dependencies AS build

# Copy source code
COPY apps/web ./apps/web/
COPY packages/types ./packages/types/
COPY packages/validation ./packages/validation/

# Build production bundle (output: apps/web/dist)
RUN pnpm --filter web build

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Stage: production
# Minimal Caddy image serving static files
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FROM caddy:2.8-alpine AS production

# Copy Caddyfile configuration
COPY apps/web/Caddyfile /etc/caddy/Caddyfile

# Copy built static files from build stage
COPY --from=build /app/apps/web/dist /srv

# Create non-root user for security (Caddy already runs as caddy user by default)
# Change ownership of static files
RUN chown -R caddy:caddy /srv

# Expose HTTP port
EXPOSE 8080

# Health check (used by Docker, ECS, K8s)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Caddy runs as non-root by default, no need to switch users
# Start Caddy with the Caddyfile
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
