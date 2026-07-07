#!/usr/bin/env bash
# Start all services using Docker Compose
# This script ensures database is healthy before starting API and Web

set -e

echo "🐳 Starting all services with Docker Compose..."
echo ""
echo "  Services:"
echo "  • Caddy:    Reverse proxy (port 80)"
echo "  • Database: PostgreSQL 15 (internal)"
echo "  • API:      Node.js + Express (internal:3000)"
echo "  • Web:      React + Vite (internal:5173)"
echo ""
echo "  Access URLs (via Caddy):"
echo "  • Frontend: https://localhost"
echo "  • API:      https://localhost/api/v1/*"
echo "  • Docs:     https://localhost/docs"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Build images if needed and start all services
# Database will start first due to depends_on in docker-compose.yml
# API waits for database health check
# Web depends on API
docker compose up --build

# Note: Ctrl+C will gracefully stop all services
