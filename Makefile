# Makefile for Plinth SaaS Starter
# Polyglot-friendly development commands for multi-service monorepo
#
# This Makefile coexists with pnpm scripts - both interfaces work equally well.
# Use 'make' for ops-style workflows, use 'pnpm' for Node.js-native workflows.

.PHONY: help dev stop restart clean logs test test-api test-web test-coverage
.PHONY: lint lint-fix format format-check typecheck check
.PHONY: build install setup
.PHONY: db-migrate db-seed db-reset db-studio

# Default target - show help
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Plinth Development Commands"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "📚 Development:"
	@echo "  make dev          Start all services (db + api + web)"
	@echo "  make stop         Stop all services"
	@echo "  make restart      Restart all services"
	@echo "  make logs         Tail database logs"
	@echo ""
	@echo "🗄️  Database:"
	@echo "  make db-migrate   Run Prisma migrations"
	@echo "  make db-seed      Seed database with test data"
	@echo "  make db-reset     Reset database (⚠️  destructive!)"
	@echo "  make db-studio    Open Prisma Studio GUI"
	@echo ""
	@echo "🧪 Testing:"
	@echo "  make test         Run all tests"
	@echo "  make test-api     Run API tests only"
	@echo "  make test-web     Run Web tests only"
	@echo "  make test-coverage Run tests with coverage report"
	@echo ""
	@echo "✨ Code Quality:"
	@echo "  make lint         Run linters"
	@echo "  make lint-fix     Fix auto-fixable lint issues"
	@echo "  make format       Format code with Prettier"
	@echo "  make format-check Check code formatting"
	@echo "  make typecheck    Run TypeScript type checking"
	@echo "  make check        Run ALL quality checks (lint + format + typecheck)"
	@echo ""
	@echo "🏗️  Build:"
	@echo "  make build        Build all services for production"
	@echo "  make clean        Remove build artifacts and stop services"
	@echo ""
	@echo "🚀 Setup:"
	@echo "  make install      Install dependencies"
	@echo "  make setup        Full first-time setup (run once)"
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  💡 Tip: All 'pnpm' commands still work alongside 'make'"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""

##@ Development Commands

dev: ## Start all services (database + API + Web)
	@./scripts/dev.sh

stop: ## Stop all services
	@echo "🛑 Stopping all services..."
	@docker compose down
	@echo "✅ All services stopped"

restart: stop dev ## Restart all services

logs: ## Tail database logs
	@docker compose logs -f db

##@ Database Commands

db-migrate: ## Run Prisma migrations
	@echo "🔄 Running database migrations..."
	@docker compose up -d db
	@echo "⏳ Waiting for database to be ready..."
	@sleep 3
	@until docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done
	@pnpm --filter api db:migrate
	@echo "✅ Migrations complete"

db-seed: ## Seed database with test data
	@echo "🌱 Seeding database..."
	@pnpm --filter api db:seed
	@echo "✅ Database seeded"

db-reset: ## Reset database (⚠️  all data will be lost)
	@echo "⚠️  Resetting database (all data will be lost)..."
	@echo "Press Ctrl+C to cancel, or wait 3 seconds to continue..."
	@sleep 3
	@pnpm --filter api db:reset
	@echo "✅ Database reset"

db-studio: ## Open Prisma Studio GUI
	@pnpm --filter api db:studio

##@ Testing Commands

test: ## Run all tests
	@echo "🧪 Running all tests..."
	@pnpm test

test-api: ## Run API tests only
	@echo "🧪 Running API tests..."
	@pnpm --filter api test

test-web: ## Run Web tests only
	@echo "🧪 Running Web tests..."
	@pnpm --filter web test

test-coverage: ## Run tests with coverage report
	@echo "📊 Running tests with coverage..."
	@pnpm --filter api test:coverage

##@ Code Quality Commands

lint: ## Run ESLint
	@echo "🔍 Running linters..."
	@pnpm lint

lint-fix: ## Fix auto-fixable lint issues
	@echo "🔧 Fixing lint issues..."
	@pnpm lint:fix

format: ## Format code with Prettier
	@echo "✨ Formatting code..."
	@pnpm format

format-check: ## Check code formatting
	@echo "🔍 Checking code formatting..."
	@pnpm format:check

typecheck: ## Run TypeScript type checking
	@echo "🔎 Running type checks..."
	@pnpm typecheck

check: lint format-check typecheck ## Run ALL quality checks
	@echo "✅ All quality checks passed!"

##@ Build Commands

build: ## Build all services for production
	@echo "🏗️  Building all services..."
	@pnpm build
	@echo "✅ Build complete"

clean: ## Remove build artifacts and stop services
	@echo "🧹 Cleaning build artifacts and stopping services..."
	@docker compose down -v
	@pnpm clean
	@echo "✅ Clean complete"

clean-deep: clean ## Deep clean (including node_modules)
	@echo "🧹 Deep cleaning (removing node_modules)..."
	@rm -rf node_modules apps/*/node_modules packages/*/node_modules
	@echo "✅ Deep clean complete"

##@ Setup Commands

install: ## Install dependencies
	@echo "📦 Installing dependencies..."
	@pnpm install
	@echo "✅ Dependencies installed"

setup: install ## Full first-time setup
	@echo "🚀 Setting up project for first-time use..."
	@if [ ! -f apps/api/.env ]; then \
		echo "📝 Creating API .env file..."; \
		cp apps/api/.env.example apps/api/.env; \
	else \
		echo "✓ API .env already exists"; \
	fi
	@if [ ! -f apps/web/.env ]; then \
		echo "📝 Creating Web .env file..."; \
		cp apps/web/.env.example apps/web/.env; \
	else \
		echo "✓ Web .env already exists"; \
	fi
	@echo "🐘 Starting database..."
	@docker compose up -d db
	@echo "⏳ Waiting for database to be ready..."
	@sleep 3
	@until docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done
	@echo "🔄 Running migrations..."
	@pnpm --filter api db:migrate
	@echo "🌱 Seeding database..."
	@pnpm --filter api db:seed
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  ✅ Setup complete!"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "  Run 'make dev' to start developing"
	@echo ""
