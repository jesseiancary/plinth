# syntax=docker/dockerfile:1

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Stage: base
# Base Node.js image with pnpm installed
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FROM node:26-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Install system dependencies for Prisma (OpenSSL for Prisma Client)
RUN apk add --no-cache openssl

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Stage: dependencies
# Install all dependencies (production + dev) and generate Prisma Client
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FROM base AS dependencies

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./

# Copy all package.json files for workspace dependency resolution
COPY apps/api/package.json ./apps/api/
COPY packages/validation/package.json ./packages/validation/

# Install all dependencies with frozen lockfile (exact versions)
RUN pnpm install --frozen-lockfile

# Copy Prisma schema
COPY apps/api/prisma ./apps/api/prisma/

# Generate Prisma Client
RUN pnpm --filter api db:generate

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Stage: development
# Development stage with hot-reload using tsx watch
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FROM dependencies AS development

# Copy source code (will be overridden by volume mount in docker-compose)
COPY apps/api ./apps/api/
COPY packages/validation ./packages/validation/

# Expose API port
EXPOSE 3000

# Set environment to development
ENV NODE_ENV=development

# Start development server with hot-reload
# Note: In docker-compose, this is overridden by volume mounts for live code updates
CMD ["pnpm", "--filter", "api", "dev"]

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Stage: build
# Compile TypeScript to JavaScript for production
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FROM dependencies AS build

# Copy root TypeScript configuration (3-tier hierarchy)
COPY tsconfig.base.json tsconfig.node.json tsconfig.bundler.json ./

# Copy source code
COPY apps/api ./apps/api/
COPY packages/validation ./packages/validation/

# Build TypeScript
RUN pnpm --filter api build

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Stage: production
# Minimal production image with only runtime dependencies
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FROM base AS production

# Install curl for health checks (used by ECS/K8s)
RUN apk add --no-cache curl

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/validation/package.json ./packages/validation/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy Prisma schema and migrations (needed for prisma migrate deploy)
COPY apps/api/prisma ./apps/api/prisma/

# Generate Prisma Client in production mode
RUN pnpm --filter api db:generate

# Copy built JavaScript from build stage
COPY --from=build /app/apps/api/dist ./apps/api/dist

# Copy validation package source (Zod schemas)
COPY packages/validation ./packages/validation/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app files
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose API port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Health check (used by Docker, ECS, K8s)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start production server
CMD ["node", "apps/api/dist/server.js"]
