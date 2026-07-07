#!/usr/bin/env bash
# Rebuild Docker containers without using cache
# Useful when:
# - Dependencies have changed (package.json, pnpm-lock.yaml)
# - Dockerfile has been modified
# - Something is broken and you want a fresh build

set -e

echo "🔨 Rebuilding all Docker containers without cache..."
echo ""
echo "⚠️  This will take longer than a normal build."
echo ""

# Stop all running containers
echo "🛑 Stopping all services..."
docker compose down

# Remove any dangling images (optional cleanup)
echo "🧹 Cleaning up dangling images..."
docker image prune -f

# Rebuild without cache
echo "🏗️  Rebuilding containers..."
docker compose build --no-cache --pull

echo ""
echo "✅ Rebuild complete!"
echo ""
echo "  Run 'make dev' to start the services"
echo ""
