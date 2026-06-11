# Makefile Architecture & Conventions

> Documentation for the Plinth Makefile and patterns for extending it with polyglot services

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Architecture Decisions](#architecture-decisions)
3. [Available Commands](#available-commands)
4. [Adding New Services](#adding-new-services)
5. [Multi-Language Patterns](#multi-language-patterns)
6. [CI/CD Integration](#cicd-integration)
7. [Troubleshooting](#troubleshooting)

---

## Philosophy

The Plinth Makefile follows these principles:

### 1. **Coexistence with npm/pnpm**

The Makefile **does not replace** package.json scripts. Both interfaces are maintained:

- **Use `make`**: Ops-style workflows, infrastructure orchestration, polyglot services
- **Use `pnpm`**: Node.js-native workflows, package-specific tasks, IDE integrations
- **CI/CD uses `pnpm`**: Explicit, auditable, language-specific

**Example:**

```bash
# Both work equally well
make dev        # Makefile → calls ./scripts/dev.sh
pnpm dev        # package.json → calls ./scripts/dev.sh

# Both call the same underlying script
```

### 2. **Zero Breaking Changes**

All existing workflows continue to work:

- ✅ `pnpm dev`, `pnpm test`, `pnpm build` - unchanged
- ✅ CI/CD pipelines - no modifications needed
- ✅ IDE npm script panels - still functional
- ✅ Git hooks via Husky - unaffected

### 3. **Progressive Enhancement**

Developers can adopt `make` gradually:

- Day 1: Use `pnpm` (what you know)
- Week 1: Try `make dev` (convenience)
- Month 1: Use `make check` in workflow (efficiency)
- Phase 7+: Add Go/Python services via Makefile (scalability)

### 4. **Polyglot-Ready**

Designed for future expansion to non-Node.js services:

- Clear target naming conventions
- Parallel execution support
- Service-specific targets
- Language-agnostic orchestration

---

## Architecture Decisions

### Why Make + pnpm (not Make vs pnpm)?

| Concern                                     | Decision          | Rationale                           |
| ------------------------------------------- | ----------------- | ----------------------------------- |
| **Node.js developers unfamiliar with Make** | Keep pnpm scripts | Don't break existing muscle memory  |
| **Future Go/Python services**               | Add Makefile      | Make is lingua franca for ops       |
| **CI/CD complexity**                        | Use pnpm in CI    | Explicit, auditable, no abstraction |
| **Local development**                       | Offer both        | Developer choice, same outcome      |
| **Docker orchestration**                    | Makefile targets  | Standard pattern across industries  |

### Make Features Used

**`.PHONY` targets:**

- Declares targets that don't create files
- Prevents conflicts with files named `test`, `build`, etc.
- Essential for all our targets

**`@` prefix:**

- Suppresses command echo (cleaner output)
- All targets use this for user-friendly output

**`##@` comments:**

- Structured help documentation
- Auto-generated help menu via `make help`

**Target dependencies:**

```makefile
restart: stop dev  # restart depends on stop, then dev
```

**Conditional logic:**

```makefile
@if [ ! -f .env ]; then \
  cp .env.example .env; \
fi
```

---

## Available Commands

### Development Lifecycle

```bash
# First-time setup (run once)
make setup        # Creates .env files, starts db, runs migrations, seeds data

# Daily development
make dev          # Start all services
make stop         # Stop all services
make restart      # Restart all services
make logs         # View database logs
```

### Database Management

```bash
make db-migrate   # Run Prisma migrations (starts db if not running)
make db-seed      # Seed with test data
make db-reset     # Reset database (⚠️  destructive, has 3-second confirmation)
make db-studio    # Open Prisma Studio GUI
```

### Testing

```bash
make test         # Run all tests (api + web)
make test-api     # API tests only
make test-web     # Web tests only
make test-coverage # API tests with coverage report
```

### Code Quality

```bash
make lint         # Run ESLint
make lint-fix     # Fix auto-fixable issues
make format       # Format with Prettier
make format-check # Check formatting (CI-friendly)
make typecheck    # Run tsc --noEmit
make check        # Run ALL checks (lint + format-check + typecheck)
```

### Build & Clean

```bash
make build        # Build for production
make clean        # Remove build artifacts, stop containers
make clean-deep   # Also remove node_modules (nuclear option)
```

---

## Adding New Services

### Pattern: Node.js Service (e.g., Background Worker)

**1. Create service directory:**

```bash
apps/worker/
├── src/
│   └── index.ts
├── package.json
└── tsconfig.json
```

**2. Add to Makefile:**

```makefile
# Near the top with other .PHONY declarations
.PHONY: worker-dev worker-build

# In development section
dev:
	@echo "🚀 Starting all services..."
	@./scripts/dev.sh  # Starts db, api, web
	@pnpm --filter worker dev  # Add worker

worker-dev: ## Start background worker only
	@pnpm --filter worker dev

# In build section
build:
	@echo "🏗️  Building all services..."
	@pnpm --recursive build  # Includes worker automatically

# In test section
test-worker: ## Run worker tests only
	@pnpm --filter worker test
```

### Pattern: Go Service (e.g., Analytics API)

**1. Create service directory:**

```bash
apps/analytics-api/
├── main.go
├── go.mod
└── go.sum
```

**2. Add to Makefile:**

```makefile
.PHONY: analytics-dev analytics-build analytics-test

analytics-dev: ## Start Go analytics API
	@echo "🚀 Starting analytics API..."
	@cd apps/analytics-api && go run main.go

analytics-build: ## Build Go analytics API
	@echo "🏗️  Building analytics API..."
	@cd apps/analytics-api && go build -o bin/analytics-api

analytics-test: ## Test Go analytics API
	@echo "🧪 Testing analytics API..."
	@cd apps/analytics-api && go test ./...

# Update main dev target
dev:
	@echo "🚀 Starting all services..."
	@docker compose up -d db redis
	@./scripts/wait-for-services.sh
	@$(MAKE) -j3 api-dev web-dev analytics-dev  # Parallel execution

api-dev:
	@pnpm --filter api dev

web-dev:
	@pnpm --filter web dev
```

**Key: `-j3` flag enables parallel execution of 3 services**

### Pattern: Python Service (e.g., ML Model)

**1. Create service directory:**

```bash
apps/ml-service/
├── main.py
├── requirements.txt
└── pyproject.toml  # If using Poetry
```

**2. Add to Makefile:**

```makefile
.PHONY: ml-dev ml-install ml-test

ml-install: ## Install Python dependencies
	@echo "📦 Installing ML service dependencies..."
	@cd apps/ml-service && pip install -r requirements.txt

ml-dev: ## Start Python ML service
	@echo "🤖 Starting ML service..."
	@cd apps/ml-service && python main.py

ml-test: ## Test Python ML service
	@echo "🧪 Testing ML service..."
	@cd apps/ml-service && pytest

# Or with Poetry
ml-dev-poetry: ## Start Python ML service (Poetry)
	@cd apps/ml-service && poetry run python main.py
```

---

## Multi-Language Patterns

### Parallel Service Startup

When you have multiple services, start them in parallel:

```makefile
dev:
	@docker compose up -d db redis
	@./scripts/wait-for-services.sh
	@$(MAKE) -j5 api-dev web-dev worker-dev analytics-dev ml-dev

# -j5 means "run 5 jobs in parallel"
```

### Conditional Service Startup

Start services based on what exists:

```makefile
dev:
	@docker compose up -d db
	@$(MAKE) api-dev web-dev
	@if [ -d apps/analytics-api ]; then $(MAKE) analytics-dev; fi
	@if [ -d apps/ml-service ]; then $(MAKE) ml-dev; fi
```

### Service-Specific Environment Variables

```makefile
analytics-dev:
	@export GO_ENV=development && \
	 export API_PORT=8080 && \
	 cd apps/analytics-api && go run main.go

ml-dev:
	@export PYTHONPATH=apps/ml-service && \
	 export MODEL_PATH=./models/latest && \
	 cd apps/ml-service && python main.py
```

### Docker Compose Integration

For services that need containers:

```makefile
# docker-compose.yml
services:
  db:
    image: postgres:15-alpine
  redis:
    image: redis:7-alpine
  analytics-api:
    build: ./apps/analytics-api
    depends_on: [db, redis]

# Makefile
analytics-dev-docker: ## Run analytics API in Docker
	@docker compose up analytics-api
```

---

## CI/CD Integration

### GitHub Actions (Current Pattern)

**CI continues using pnpm** for explicit, auditable builds:

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm test # NOT make test

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint # NOT make lint
```

**Why not use `make` in CI?**

- Adds layer of indirection (harder to debug)
- Make not guaranteed on all CI runners
- pnpm provides explicit, auditable commands
- CI uses GitHub Actions cache for pnpm, not Make

### When to Use Make in CI

**Only for multi-language builds:**

```yaml
# Future: When we have Go/Python services
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v4
      - uses: actions/setup-python@v4
      - uses: pnpm/action-setup@v2
      - run: make install # Installs deps for ALL languages
      - run: make build # Builds ALL services
```

### Production Deployment

Make is useful for deployment scripts:

```makefile
deploy-staging: ## Deploy to staging
	@echo "🚀 Deploying to staging..."
	@docker build -t plinth-api:staging apps/api
	@docker build -t plinth-web:staging apps/web
	@docker push plinth-api:staging
	@docker push plinth-web:staging
	@kubectl apply -f k8s/staging/

deploy-prod: ## Deploy to production
	@echo "🚀 Deploying to production..."
	@echo "Are you sure? (yes/no)"
	@read confirm && [ "$$confirm" = "yes" ]
	@docker build -t plinth-api:latest apps/api
	@docker build -t plinth-web:latest apps/web
	@docker push plinth-api:latest
	@docker push plinth-web:latest
	@kubectl apply -f k8s/production/
```

---

## Troubleshooting

### Make: command not found

**MacOS:**

```bash
xcode-select --install
```

**Ubuntu/Debian:**

```bash
sudo apt-get install build-essential
```

**Already installed on:** Most Linux distros, WSL, macOS (via Xcode)

### Target not running (no error)

Check if target is declared as `.PHONY`:

```makefile
.PHONY: my-target  # Add this

my-target:
	@echo "Running target"
```

### Parallel execution not working

Ensure you're using `-j` flag:

```makefile
# Wrong
dev: api-dev web-dev worker-dev

# Right
dev:
	@$(MAKE) -j3 api-dev web-dev worker-dev
```

### Docker commands failing

Ensure Docker daemon is running:

```bash
docker ps  # Should list containers, not error

# Start Docker if needed
sudo systemctl start docker  # Linux
open -a Docker  # macOS
```

### Environment variables not propagating

Use `export` in same line as command:

```makefile
# Wrong
target:
	export FOO=bar
	@echo $$FOO  # Empty

# Right
target:
	@export FOO=bar && echo $$FOO  # Prints "bar"
```

---

## Best Practices

### 1. Always Use `.PHONY`

```makefile
.PHONY: build test clean
```

### 2. Always Use `@` for User Commands

```makefile
# User-facing
build:
	@echo "Building..."
	@pnpm build

# Debug (show commands)
build-debug:
	echo "Building..."
	pnpm build
```

### 3. Add Help Text to New Targets

```makefile
my-target: ## Short description here
	@echo "Doing something"
```

### 4. Group Related Targets

```makefile
##@ Database Commands
db-migrate:
db-seed:
db-reset:

##@ Testing Commands
test:
test-api:
test-web:
```

### 5. Provide Safe Defaults

```makefile
# Dangerous operation - add confirmation
db-reset:
	@echo "⚠️  This will delete all data. Continue? (Ctrl+C to cancel)"
	@sleep 3
	@pnpm --filter api db:reset
```

---

## Future Expansion Examples

### Phase 7: Background Worker (Node.js)

```makefile
.PHONY: worker-dev worker-test

dev:
	@$(MAKE) -j4 api-dev web-dev worker-dev analytics-dev

worker-dev:
	@pnpm --filter worker dev

worker-test:
	@pnpm --filter worker test
```

### Phase 8: Analytics API (Go)

```makefile
.PHONY: analytics-dev analytics-build analytics-test

analytics-dev:
	@cd apps/analytics-api && air  # Live reload for Go

analytics-build:
	@cd apps/analytics-api && go build -o bin/analytics-api

analytics-test:
	@cd apps/analytics-api && go test -v ./...
```

### Phase 9: ML Service (Python)

```makefile
.PHONY: ml-dev ml-test ml-train

ml-dev:
	@cd apps/ml-service && poetry run uvicorn main:app --reload

ml-test:
	@cd apps/ml-service && poetry run pytest

ml-train:
	@cd apps/ml-service && poetry run python train_model.py
```

---

## Comparison: Make vs Task vs Just

| Tool            | Pros                                    | Cons                                   | Use Case                    |
| --------------- | --------------------------------------- | -------------------------------------- | --------------------------- |
| **Make**        | Universal, installed everywhere, mature | Arcane syntax, whitespace sensitivity  | Multi-language, ops-focused |
| **Task**        | Modern YAML syntax, cross-platform      | Requires installation, Go dependency   | Pure task runner            |
| **Just**        | Clean syntax, good errors               | Requires installation, Rust dependency | Command runner              |
| **npm scripts** | Zero install, Node native               | JSON limitations, Node-only            | Pure Node.js projects       |

**Plinth uses Make because:**

- ✅ Already installed on WSL/Linux/macOS
- ✅ Industry standard for polyglot projects
- ✅ Portfolio value (shows ops knowledge)
- ✅ Future-proof for Go/Python/Rust services

---

## References

- [GNU Make Manual](https://www.gnu.org/software/make/manual/)
- [Make for Monorepos](https://github.com/casey/just#comparison-to-make)
- [Makefile Style Guide](https://clarkgrubb.com/makefile-style-guide)
- [Self-Documenting Makefiles](https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html)

---

## Questions?

See the root `Makefile` for implementation details, or run `make help` for all available commands.
