#!/usr/bin/env bash
# Open an interactive shell in a running Docker container
# Usage: ./scripts/docker-shell.sh [api|web]

set -e

SERVICE=$1

if [ -z "$SERVICE" ]; then
  echo "Usage: ./scripts/docker-shell.sh [api|web]"
  echo ""
  echo "Examples:"
  echo "  ./scripts/docker-shell.sh api   # Open shell in API container"
  echo "  ./scripts/docker-shell.sh web   # Open shell in Web container"
  echo ""
  exit 1
fi

if [ "$SERVICE" != "api" ] && [ "$SERVICE" != "web" ]; then
  echo "❌ Error: Service must be 'api' or 'web'"
  echo ""
  echo "Usage: ./scripts/docker-shell.sh [api|web]"
  exit 1
fi

# Check if container is running
if ! docker compose ps --services --filter "status=running" | grep -q "^${SERVICE}$"; then
  echo "❌ Error: ${SERVICE} container is not running"
  echo ""
  echo "Start the services with: make dev"
  exit 1
fi

echo "🐚 Opening shell in ${SERVICE} container..."
echo ""
echo "  Working directory: /app"
echo "  Package manager:   pnpm"
echo "  Type 'exit' to close the shell"
echo ""

# Open interactive shell in container
docker compose exec "$SERVICE" sh
