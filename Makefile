# Makefile for Plinth SaaS Starter
# Docker-first development workflow for multi-service monorepo
#
# All commands execute inside Docker containers - no local Node.js/pnpm required.
# Prerequisites: Docker 24+, Docker Compose v2, Make

.PHONY: help dev dev-detached stop restart rebuild clean
.PHONY: logs logs-api logs-web logs-db
.PHONY: shell-api shell-web shell-db
.PHONY: test test-api test-web test-coverage
.PHONY: test-docker test-docker-api test-docker-web test-docker-clean
.PHONY: lint lint-fix format format-check typecheck check
.PHONY: build build-prod
.PHONY: db-connect db-migrate db-seed db-reset db-studio
.PHONY: setup

# Default target - show help
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Plinth Development Commands (Docker-First)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "📚 Development:"
	@echo "  make dev                Start all services (db + api + web) with logs"
	@echo "  make dev-detached       Start all services in background"
	@echo "  make stop               Stop all services"
	@echo "  make restart            Restart all services"
	@echo "  make rebuild            Rebuild containers (no cache)"
	@echo ""
	@echo "📋 Logs:"
	@echo "  make logs               Tail all service logs"
	@echo "  make logs-api           Tail API logs"
	@echo "  make logs-web           Tail Web logs"
	@echo "  make logs-db            Tail database logs"
	@echo ""
	@echo "💻 Shell Access:"
	@echo "  make shell-api          Open shell in API container"
	@echo "  make shell-web          Open shell in Web container"
	@echo "  make shell-db           Open PostgreSQL shell"
	@echo ""
	@echo "🗄️  Database:"
	@echo "  make db-connect         Connect to database (psql shell)"
	@echo "  make db-migrate         Run Prisma migrations"
	@echo "  make db-seed            Seed database with test data"
	@echo "  make db-reset           Reset database (⚠️  destructive!)"
	@echo "  make db-studio          Open Prisma Studio GUI"
	@echo ""
	@echo "🧪 Testing:"
	@echo "  make test               Run all tests (in dev containers)"
	@echo "  make test-api           Run API tests only"
	@echo "  make test-web           Run Web tests only"
	@echo "  make test-coverage      Run tests with coverage report"
	@echo ""
	@echo "🧪 Testing (Isolated):"
	@echo "  make test-docker        Run all tests in isolated test containers"
	@echo "  make test-docker-api    Run API tests in isolated test container"
	@echo "  make test-docker-web    Run Web tests in isolated test container"
	@echo "  make test-docker-clean  Clean up test containers and volumes"
	@echo ""
	@echo "✨ Code Quality:"
	@echo "  make lint               Run linters (all packages)"
	@echo "  make lint-fix           Fix auto-fixable lint issues"
	@echo "  make format             Format code with Prettier"
	@echo "  make format-check       Check code formatting"
	@echo "  make typecheck          Run TypeScript type checking (all packages)"
	@echo "  make validate-openapi   Validate OpenAPI specification"
	@echo "  make check              Run ALL checks (lint + format + typecheck + openapi)"
	@echo ""
	@echo "🏗️  Build:"
	@echo "  make build              Build production Docker images"
	@echo "  make clean              Stop services and remove volumes"
	@echo ""
	@echo "🚀 Setup:"
	@echo "  make setup              Full first-time setup (run once)"
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  💡 All commands run inside Docker containers"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""

##@ Development Commands

dev: ## Start all services with logs (Ctrl+C to stop)
	@./scripts/dev.sh

dev-detached: ## Start all services in background
	@echo "🚀 Starting all services in background..."
	@docker compose up -d --build
	@echo ""
	@echo "✅ Services started!"
	@echo ""
	@echo "  All traffic routes through Caddy reverse proxy (HTTPS):"
	@echo "  Frontend: https://localhost"
	@echo "  API:      https://localhost/api/v1/*"
	@echo "  Docs:     https://localhost/docs"
	@echo ""
	@echo "  ⚠️  Browser will show security warning (self-signed cert) - this is normal"
	@echo ""
	@echo "  Use 'make logs' to view logs"
	@echo "  Use 'make stop' to stop services"
	@echo "  Use 'make shell-api' to open shell in API container"
	@echo "  Use 'make shell-web' to open shell in Web container"
	@echo ""

stop: ## Stop all services
	@echo "🛑 Stopping all services..."
	@docker compose down
	@echo "✅ All services stopped"

restart: ## Restart all services
	@echo "🔄 Restarting all services..."
	@docker compose restart api web
	@echo "✅ Services restarted"

rebuild: ## Rebuild containers without cache
	@./scripts/docker-rebuild.sh

##@ Logs

logs: ## Tail all service logs
	@docker compose logs -f

logs-api: ## Tail API logs
	@docker compose logs -f api

logs-web: ## Tail Web logs
	@docker compose logs -f web

logs-db: ## Tail database logs
	@docker compose logs -f db

##@ Shell Access

shell-api: ## Open shell in API container
	@./scripts/docker-shell.sh api

shell-web: ## Open shell in Web container
	@./scripts/docker-shell.sh web

shell-db: ## Open PostgreSQL shell
	@docker compose exec db psql -U plinth_dev -d plinth_dev

##@ Database Commands

db-connect: ## Connect to database (alias for shell-db)
	@docker compose exec db psql -U plinth_dev -d plinth_dev


db-migrate: ## Run Prisma migrations
	@echo "🔄 Running database migrations..."
	@docker compose up -d db
	@echo "⏳ Waiting for database to be ready..."
	@until docker compose exec -T db pg_isready -U plinth_dev > /dev/null 2>&1; do sleep 1; done
	@docker compose exec api pnpm --filter api db:migrate
	@echo "✅ Migrations complete"

db-seed: ## Seed database with test data
	@echo "🌱 Seeding database..."
	@docker compose exec api pnpm --filter api db:seed
	@echo "✅ Database seeded"

db-reset: ## Reset database (⚠️  all data will be lost)
	@echo "⚠️  Resetting database (all data will be lost)..."
	@echo "Press Ctrl+C to cancel, or wait 3 seconds to continue..."
	@sleep 3
	@docker compose exec api pnpm --filter api db:reset
	@echo "✅ Database reset"

db-studio: ## Open Prisma Studio GUI
	@echo "🎨 Opening Prisma Studio..."
	@echo "  Prisma Studio will be available at http://localhost:5555"
	@docker compose exec api pnpm --filter api db:studio

##@ Testing Commands

test: test-api test-web ## Run all tests

test-api: ## Run API tests only
	@echo "🧪 Running API tests..."
	@docker compose exec api pnpm --filter api test

test-web: ## Run Web tests only
	@echo "🧪 Running Web tests..."
	@docker compose exec web pnpm --filter web test

test-coverage: ## Run tests with coverage report
	@echo "📊 Running tests with coverage..."
	@docker compose exec api pnpm --filter api test:coverage
	@docker compose exec web pnpm --filter web test:coverage

##@ Testing Commands (Isolated)

test-docker: test-docker-api test-docker-web ## Run all tests in isolated test containers

test-docker-api: ## Run API tests in isolated test container
	@echo "🧪 Running API tests in isolated test container..."
	@echo "  Starting test database..."
	@docker compose -f docker-compose.test.yml up -d db-test
	@echo "  Waiting for database to be ready..."
	@until docker compose -f docker-compose.test.yml exec -T db-test pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done
	@echo "  Installing dependencies..."
	@docker compose -f docker-compose.test.yml run --rm api-test sh -c "cd /app && pnpm install --frozen-lockfile"
	@echo "  Generating Prisma client..."
	@docker compose -f docker-compose.test.yml run --rm api-test sh -c "cd /app/apps/api && pnpm db:generate"
	@echo "  Running database migrations..."
	@docker compose -f docker-compose.test.yml run --rm api-test sh -c "cd /app/apps/api && pnpm db:migrate:deploy"
	@echo "  Running API tests..."
	@docker compose -f docker-compose.test.yml run --rm api-test sh -c "cd /app/apps/api && pnpm test"
	@echo "  Cleaning up..."
	@docker compose -f docker-compose.test.yml down
	@echo "✅ API tests complete"

test-docker-web: ## Run Web tests in isolated test container
	@echo "🧪 Running Web tests in isolated test container..."
	@echo "  Installing dependencies..."
	@docker compose -f docker-compose.test.yml run --rm web-test sh -c "cd /app && pnpm install --frozen-lockfile"
	@echo "  Running Web tests..."
	@docker compose -f docker-compose.test.yml run --rm web-test sh -c "cd /app/apps/web && pnpm test"
	@echo "  Cleaning up..."
	@docker compose -f docker-compose.test.yml down
	@echo "✅ Web tests complete"

test-docker-clean: ## Clean up test containers and volumes
	@echo "🧹 Cleaning up test containers and volumes..."
	@docker compose -f docker-compose.test.yml down -v --remove-orphans
	@echo "✅ Test environment cleaned"

##@ Code Quality Commands

lint: ## Run ESLint on all packages
	@echo "🔍 Running linters..."
	@echo "  → Checking: api, validation..."
	@docker compose exec api pnpm --filter api --filter validation lint
	@echo "  → Checking: web..."
	@docker compose exec web pnpm --filter web lint
	@echo "✅ Linting complete"

lint-fix: ## Fix auto-fixable lint issues
	@echo "🔧 Fixing lint issues..."
	@echo "  → Fixing: api, validation..."
	@docker compose exec api pnpm --filter api --filter validation lint:fix
	@echo "  → Fixing: web..."
	@docker compose exec web pnpm --filter web lint:fix
	@echo "✅ Lint fixes complete"

format: ## Format code with Prettier
	@echo "✨ Formatting code..."
	@echo "  → Formatting: api, packages, root files..."
	@docker compose exec api pnpm --filter plinth format
	@echo "  → Formatting: web..."
	@docker compose exec web pnpm --filter plinth format
	@echo "✅ Code formatted"

format-check: ## Check code formatting
	@echo "🔍 Checking code formatting..."
	@echo "  → Checking: api, packages, root files..."
	@docker compose exec api pnpm --filter plinth format:check
	@echo "  → Checking: web..."
	@docker compose exec web pnpm --filter plinth format:check
	@echo "✅ Format check complete"

typecheck: ## Run TypeScript type checking
	@echo "🔎 Running type checks..."
	@echo "  → Checking: api, types, validation..."
	@docker compose exec api pnpm --filter api --filter types --filter validation typecheck
	@echo "  → Checking: web..."
	@docker compose exec web pnpm --filter web typecheck
	@echo "✅ Type checking complete"

validate-openapi: ## Validate OpenAPI specification
	@echo "📋 Validating OpenAPI spec..."
	@docker compose exec api pnpm --filter openapi validate
	@echo "✅ OpenAPI spec valid"

check: lint format-check typecheck validate-openapi ## Run ALL quality checks
	@echo "✅ All quality checks passed!"

##@ Build Commands

build: ## Build production Docker images
	@echo "🏗️  Building production Docker images..."
	@docker compose build --target production api web
	@echo "✅ Production images built"
	@echo ""
	@echo "  To run production images locally:"
	@echo "  docker compose -f docker-compose.prod.yml up"
	@echo ""

clean: ## Stop services and remove volumes
	@echo "🧹 Stopping services and removing volumes..."
	@docker compose down -v --remove-orphans
	@echo "✅ Clean complete"

##@ Setup Commands

setup: ## Full first-time setup
	@echo "🚀 Setting up Plinth for first-time use..."
	@echo ""
	@# Prevent accidental overwrite of existing credentials
	@if [ -f .env ]; then \
		echo "❌ ERROR: .env already exists"; \
		echo ""; \
		echo "   To regenerate credentials, first run:"; \
		echo "   make clean    # Stops services and removes volumes"; \
		echo ""; \
		echo "   Or manually remove .env files:"; \
		echo "   rm .env apps/api/.env apps/web/.env"; \
		echo ""; \
		exit 1; \
	fi
	@# Generate secure credentials
	@echo "🔐 Generating secure credentials..."
	@DB_PASSWORD=$$(openssl rand -hex 32); \
	JWT_SECRET=$$(openssl rand -base64 32); \
	JWT_REFRESH=$$(openssl rand -base64 32); \
	echo "  ✓ Database password (hex, 64 chars, 256-bit entropy, URL-safe)"; \
	echo "  ✓ JWT secret (base64, 44 chars, 264-bit entropy)"; \
	echo "  ✓ JWT refresh secret (base64, 44 chars, 264-bit entropy)"; \
	echo ""; \
	echo "📝 Creating configuration files..."; \
	echo "POSTGRES_USER=plinth_dev" > .env; \
	echo "POSTGRES_PASSWORD=$$DB_PASSWORD" >> .env; \
	echo "POSTGRES_DB=plinth_dev" >> .env; \
	echo "POSTGRES_PORT=5432" >> .env; \
	echo "  ✓ .env (database credentials)"; \
	echo "DATABASE_URL=postgresql://plinth_dev:$$DB_PASSWORD@db:5432/plinth_dev" > apps/api/.env; \
	echo "" >> apps/api/.env; \
	echo "# JWT" >> apps/api/.env; \
	echo "JWT_SECRET=$$JWT_SECRET" >> apps/api/.env; \
	echo "JWT_REFRESH_SECRET=$$JWT_REFRESH" >> apps/api/.env; \
	echo "JWT_ACCESS_EXPIRY=15m" >> apps/api/.env; \
	echo "JWT_REFRESH_EXPIRY=7d" >> apps/api/.env; \
	echo "" >> apps/api/.env; \
	echo "# SMTP" >> apps/api/.env; \
	echo "SMTP_HOST=smtp.example.com" >> apps/api/.env; \
	echo "SMTP_PORT=587" >> apps/api/.env; \
	echo "SMTP_USER=your-smtp-user" >> apps/api/.env; \
	echo "SMTP_PASS=your-smtp-password" >> apps/api/.env; \
	echo "" >> apps/api/.env; \
	echo "# URLs" >> apps/api/.env; \
	echo "API_URL=https://localhost" >> apps/api/.env; \
	echo "" >> apps/api/.env; \
	echo "# Environment" >> apps/api/.env; \
	echo "NODE_ENV=development" >> apps/api/.env; \
	echo "PORT=3000" >> apps/api/.env; \
	echo "" >> apps/api/.env; \
	echo "# Logging" >> apps/api/.env; \
	echo "LOG_LEVEL=info" >> apps/api/.env; \
	echo "  ✓ apps/api/.env (API configuration)"; \
	cp apps/web/.env.example apps/web/.env; \
	echo "  ✓ apps/web/.env (web configuration)"; \
	echo ""; \
	echo "⚠️  IMPORTANT: Credentials saved to .env files (gitignored)"; \
	echo "   - Passwords are NOT displayed (check .env files if needed)"; \
	echo "   - Backup these files - passwords cannot be recovered if lost"; \
	echo "   - Never commit .env files to version control"; \
	echo ""
	@echo "🐳 Building Docker images..."
	@docker compose build
	@echo ""
	@echo "🐘 Starting database..."
	@docker compose up -d db
	@echo "⏳ Waiting for database to be ready..."
	@until docker compose exec -T db pg_isready -U plinth_dev > /dev/null 2>&1; do sleep 1; done
	@echo ""
	@echo "🔄 Running migrations..."
	@docker compose run --rm -e NODE_ENV=development api sh -c 'cd /app/apps/api && pnpm db:migrate'
	@echo ""
	@echo "🌱 Seeding database..."
	@docker compose run --rm api sh -c 'set -a; source /app/apps/api/.env; set +a; cd /app/apps/api && pnpm db:seed'
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  ✅ Setup complete!"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "  Run 'make dev' to start developing"
	@echo ""
