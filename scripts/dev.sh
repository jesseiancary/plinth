#!/usr/bin/env bash
set -e

echo "🐘 Starting PostgreSQL database..."
docker compose up -d db

echo "⏳ Waiting for database to be ready..."
max_attempts=30
attempt=0

until docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo "❌ Database failed to start after ${max_attempts} seconds"
    exit 1
  fi
  sleep 1
done

echo "✅ Database is ready!"
echo ""
echo "🚀 Starting API and Web services..."
echo ""

# Start API and Web in parallel (Ctrl+C will kill both)
pnpm --parallel --filter api --filter web dev
