# Docker Architecture & Developer Guide

> Comprehensive documentation for Plinth's Docker-first development workflow

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Multi-Stage Dockerfiles](#multi-stage-dockerfiles)
4. [Docker Compose Setup](#docker-compose-setup)
5. [Hot-Reload Development](#hot-reload-development)
6. [Volume Management](#volume-management)
7. [Networking](#networking)
8. [Security Architecture](#security-architecture)
9. [Test Environment](#test-environment)
10. [Production Builds](#production-builds)
11. [Troubleshooting](#troubleshooting)
12. [Best Practices](#best-practices)

---

## Overview

Plinth uses a Docker-first development workflow:

- **Zero host dependencies**: No Node.js, pnpm, or PostgreSQL installation required
- **Instant hot-reload**: Source code changes reflected immediately (tsx watch + Vite HMR)
- **Production parity**: Same Dockerfiles used for development and production
- **Cloud-native ready**: Optimized for AWS ECS/Fargate deployment

**Prerequisites:**

- Docker 24+ ([Install](https://docs.docker.com/get-docker/))
- Docker Compose v2 (bundled with Docker Desktop)
- Make (standard on macOS/Linux, Git Bash on Windows)

---

## Architecture

### Overview Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Host Machine                                            │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Docker Compose                                     │ │
│  │                                                    │ │
│  │  ┌───────────────────────────────────────────────┐ │ │
│  │  │             Caddy (Reverse Proxy)             │ │ │
│  │  │                   :80                         │ │ │
│  │  └───────────────────┬───────────────────────────┘ │ │
│  │                      │                             │ │
│  │         ┌────────────┴────────────┐                │ │
│  │         ▼                         ▼                │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │ │
│  │  │   DB        │  │    API      │  │    Web      │ │ │
│  │  │             │  │             │  │             │ │ │
│  │  │ PostgreSQL  │  │ Node 24     │  │ Node 24     │ │ │
│  │  │ :5432       │  │ Express     │  │ Vite        │ │ │
│  │  │ (internal)  │◄─┤ Prisma      │◄─┤ React       │ │ │
│  │  │             │  │ tsx watch   │  │ HMR         │ │ │
│  │  │             │  │ :3000       │  │ :5173       │ │ │
│  │  │             │  │ (internal)  │  │ (internal)  │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │ │
│  │                                                    │ │
│  │  Volumes:                                          │ │
│  │  • postgres-data (persists DB)                     │ │
│  │  • caddy_data (persists certs)                     │ │
│  │  • api_node_modules (isolates deps)                │ │
│  │  • web_node_modules (isolates deps)                │ │
│  │  • ./apps/api → /app/apps/api (hot-reload)         │ │
│  │  • ./apps/web → /app/apps/web (hot-reload)         │ │
│  │  • ./Caddyfile.local → /etc/caddy/Caddyfile        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
                        ↑
                        │
                  localhost:80
            (single entry point)
```

### Reverse Proxy Architecture (Production Parity)

Development uses **Caddy** as a reverse proxy to match production's AWS Application Load Balancer (ALB) pattern:

**Traffic Flow:**

```
Browser Request (https://localhost)
    ↓
Caddy Container (ports 80/443, auto-HTTPS)
    ├─ /api/*  → http://api:3000 (internal network only)
    └─ /*      → http://web:5173 (internal network only)
```

**Why Reverse Proxy in Development?**

1. **Production Parity** — Matches AWS ALB routing in production
2. **Security** — Services not directly exposed to host machine
3. **Single Entry Point** — All traffic through ports 80/443 (HTTPS by default)
4. **Clean URLs** — `https://localhost` vs `http://localhost:3000`
5. **Automatic HTTPS** — Caddy auto-generates self-signed certificate for localhost

**Service Access:**

| What            | URL                           | Notes                           |
| --------------- | ----------------------------- | ------------------------------- |
| Frontend        | `https://localhost`           | Served by Caddy → Web (5173)    |
| API Health      | `https://localhost/health`    | Proxied to API container        |
| API Docs        | `https://localhost/docs`      | OpenAPI spec (Scalar UI)        |
| Direct API Call | `https://localhost/api/v1/*`  | All `/api/*` routed to API:3000 |
| Vite HMR        | `wss://localhost` (automatic) | WebSocket proxied by Caddy      |

**Internal vs External Ports:**

- **External (host accessible)**: Port 80 (Caddy only)
- **Internal (Docker network only)**:
  - API: 3000
  - Web: 5173
  - DB: 5432

The API and Web services use `expose` (not `ports`) in docker-compose.yml, making them accessible only within the Docker network. Caddy handles all external traffic routing.

---

## Multi-Stage Dockerfiles

### API Dockerfile (`docker/api.Dockerfile`)

```dockerfile
# Stage 1: base (Node 24 + pnpm)
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Stage 2: dependencies (install all deps + generate Prisma Client)
FROM base AS dependencies
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile
COPY apps/api/prisma ./apps/api/prisma/
RUN pnpm --filter api db:generate

# Stage 3: development (tsx watch for hot-reload)
FROM dependencies AS development
COPY apps/api ./apps/api/
EXPOSE 3000
CMD ["pnpm", "--filter", "api", "dev"]

# Stage 4: build (compile TypeScript)
FROM dependencies AS build
COPY apps/api ./apps/api/
RUN pnpm --filter api build

# Stage 5: production (minimal runtime image)
FROM base AS production
RUN apk add --no-cache curl
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
HEALTHCHECK CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "apps/api/dist/server.js"]
```

**Key Design Decisions:**

| Stage          | Purpose                         | Used By                     |
| -------------- | ------------------------------- | --------------------------- |
| `base`         | Shared foundation (Node + pnpm) | All stages                  |
| `dependencies` | Install deps + generate Prisma  | Development + Production    |
| `development`  | Hot-reload with tsx watch       | `make dev` (Docker Compose) |
| `build`        | Compile TypeScript to JS        | Production stage            |
| `production`   | Minimal runtime (no dev deps)   | AWS ECS deployment          |

### Web Dockerfile (`docker/web.Dockerfile`)

Similar structure, but production stage uses **Caddy** to serve static files:

```dockerfile
# ... base, dependencies, development stages ...

# Stage: production (Caddy serving static files)
FROM caddy:2.8-alpine AS production
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
EXPOSE 8080
HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
```

**Why Caddy?**

- React apps compile to static files (HTML, JS, CSS)
- Caddy is optimized for serving static content (automatic compression, caching, security headers)
- Automatic HTTPS in production (Let's Encrypt integration)
- Smaller image size than Node.js runtime

---

## Docker Compose Setup

### Service Configuration

**Database Service:**

```yaml
db:
  image: postgres:15-alpine
  ports:
    - '5432:5432'
  environment:
    POSTGRES_USER: plinth_dev
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD} # From .env
  volumes:
    - postgres-data:/var/lib/postgresql/data
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U plinth_dev']
    interval: 10s
  networks:
    - plinth-network
```

**API Service:**

```yaml
api:
  build:
    context: .
    dockerfile: docker/api.Dockerfile
    target: development # Use development stage
  ports:
    - '3000:3000'
  environment:
    DATABASE_URL: postgresql://plinth_dev:${POSTGRES_PASSWORD}@db:5432/plinth_dev
    # Note: Uses service name 'db', not 'localhost'
  volumes:
    - ./apps/api:/app/apps/api # Source code (hot-reload)
    - ./packages:/app/packages # Shared packages
    - api_node_modules:/app/node_modules # Isolated deps
  depends_on:
    db:
      condition: service_healthy # Wait for DB health check
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
```

**Web Service:**

```yaml
web:
  build:
    context: .
    dockerfile: docker/web.Dockerfile
    target: development # Vite dev server with HMR
  ports:
    - '5173:5173'
  environment:
    VITE_API_URL: http://localhost # Accessed from browser through Caddy proxy
  volumes:
    - ./apps/web:/app/apps/web
    - ./packages:/app/packages
    - web_node_modules:/app/node_modules
  depends_on:
    - api # Start after API
```

### Named Volumes

```yaml
volumes:
  postgres-data: # Persists database across restarts
  api_node_modules: # Isolates API dependencies
  api_app_node_modules: # Isolates API app-level dependencies
  web_node_modules: # Isolates Web dependencies
  web_app_node_modules: # Isolates Web app-level dependencies
  pnpm_store: # Shared pnpm cache across services
```

**Why separate `node_modules` volumes?**

- Avoids permission issues (Docker runs as root, host may be different user)
- Faster builds (pnpm cache shared)
- Prevents host `node_modules` from interfering with container `node_modules`

---

## Hot-Reload Development

### How It Works

1. **Volume Mounts**: Source code on host is mounted into container:

   ```yaml
   volumes:
     - ./apps/api:/app/apps/api # Bidirectional sync
   ```

2. **File Watchers**:
   - **API**: `tsx watch` monitors file changes and restarts the server
   - **Web**: Vite HMR (Hot Module Replacement) updates browser without reload

3. **Edit-Save-Reflect** Workflow:
   ```
   1. Edit apps/api/src/routes/health.ts on host
   2. tsx watch detects change inside container
   3. Server restarts automatically (~1 second)
   4. curl https://localhost/health (new code running via Caddy)
   ```

### What Triggers Rebuild?

| Change                       | Requires Rebuild? | Reason                                      |
| ---------------------------- | ----------------- | ------------------------------------------- |
| Edit `.ts` file              | ❌ No             | Volume-mounted, tsx watch handles it        |
| Edit `.tsx` React component  | ❌ No             | Volume-mounted, Vite HMR handles it         |
| Add new npm package          | ✅ Yes            | `package.json` changed, need `pnpm install` |
| Update Prisma schema         | ✅ Yes            | Need to run `prisma generate`               |
| Modify Dockerfile            | ✅ Yes            | Build steps changed                         |
| Change environment variables | ⚠️ Restart        | Stop/start containers (not full rebuild)    |

**Rebuild command:**

```bash
make rebuild  # Rebuilds all containers without cache
```

---

## Volume Management

### Inspecting Volumes

```bash
# List all Plinth volumes
docker volume ls | grep plinth

# Inspect specific volume
docker volume inspect plinth_postgres-data

# View volume contents (advanced)
docker run --rm -v plinth_api_node_modules:/data alpine ls -la /data
```

### Cleaning Volumes

```bash
# Remove all volumes (⚠️  destroys database!)
make clean

# Remove specific volume
docker volume rm plinth_postgres-data

# Remove orphaned volumes (not attached to any container)
docker volume prune
```

---

## Networking

### Service-to-Service Communication

Containers communicate using **service names** defined in `docker-compose.yml`:

```
API → Database:  postgresql://user:pass@db:5432/plinth_dev
                                       ↑
                                Service name, not localhost
```

### Browser → API Communication

Browser runs on **host machine** and all traffic routes through **Caddy reverse proxy**:

```
Browser → Caddy:     https://localhost (ports 80/443, auto-HTTPS)
Caddy → Web:         http://web:5173 (Docker network, internal only)
Caddy → API:         http://api:3000 (Docker network, internal only)
Web (internal) → DB: postgresql://db:5432 (Docker network)
```

**Environment Variable Pattern:**

```bash
# apps/api/.env (container-to-container networking)
DATABASE_URL=postgresql://plinth_dev:password@db:5432/plinth_dev
                                            ↑ Service name (Docker network)

# apps/web/.env (browser access through Caddy)
VITE_API_URL=https://localhost
                   ↑ Browser connects to Caddy (HTTPS), which routes to API
```

**IMPORTANT:** Services are NOT directly accessible from the host:

- ❌ `http://localhost:3000` (API port not exposed)
- ❌ `http://localhost:5173` (Web port not exposed)
- ✅ `https://localhost` (Caddy routes all traffic with auto-HTTPS)

---

## Security Architecture

### Network Isolation Strategy

Docker Compose provides **defense-in-depth** security through network isolation:

```
┌──────────────────────────────────────────────────────────────┐
│ Host Machine (Your Computer)                                 │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Docker Network (plinth-network) - ISOLATED             │  │
│  │                                                        │  │
│  │  ┌──────────┐      ┌─────────┐  ┌─────────┐  ┌──────┐  │  │
│  │  │  Caddy   │─────→│ API     │  │  Web    │  │ DB   │  │  │
│  │  │ (Proxy)  │      │ Node.js │  │  Vite   │  │ PG15 │  │  │
│  │  └──────────┘      └─────────┘  └─────────┘  └──────┘  │  │
│  │   Ports:            Internal     Internal    Internal  │  │
│  │   80/443            3000         5173        5432      │  │
│  │       ▲                                                │  │
│  └───────┼────────────────────────────────────────────────┘  │
│          │ (Only Caddy exposed to host)                      │
└──────────┼───────────────────────────────────────────────────┘
           │
           ▼
    Browser → https://localhost (self-signed cert)
```

### Port Exposure Strategy

**Exposed to Host (Public):**

- **Caddy (80/443):** HTTPS reverse proxy with auto-generated self-signed certificate

**Internal Only (Private):**

- **API (3000):** Accessible only via Caddy reverse proxy
- **Web (5173):** Accessible only via Caddy reverse proxy
- **Database (5432):** Accessible only within Docker network

### Security Benefits

| Without Docker Isolation | With Docker Isolation | Benefit                           |
| ------------------------ | --------------------- | --------------------------------- |
| 5 ports exposed          | 2 ports exposed       | 60% attack surface reduction      |
| DB on local network      | DB internal-only      | Prevents unauthorized DB access   |
| Direct service access    | Proxy-only access     | Centralized access control        |
| HTTP development         | HTTPS development     | Production parity, secure cookies |

### Database Security

**Why Database Port Isn't Exposed:**

✅ **Reduces attack surface:** No port 5432 open on host machine
✅ **Prevents accidental exposure:** Database not accessible from local network
✅ **Forces controlled access:** Must use `make db-connect` or internal networking
✅ **Follows least privilege:** Only services that need DB access can reach it

**Accessing the Database:**

```bash
# Recommended: Connect via Docker exec (no port exposure needed)
make db-connect

# Alternative: Exec into container manually
docker compose exec db psql -U plinth_dev -d plinth_dev

# For GUI tools only: Temporarily expose port (DEBUGGING ONLY)
# Uncomment ports section in docker-compose.yml:
#   ports:
#     - '5432:5432'
# ⚠️  Remember to comment it out and never commit!
```

### HTTPS with Self-Signed Certificate

**Why HTTPS in Development?**

Modern web features require secure contexts:

- `httpOnly` cookies (JWT refresh tokens)
- Service Workers (PWA features)
- Web Crypto API, Clipboard API, Geolocation

**Certificate Warning:**

Browsers will show a security warning for `https://localhost` because Caddy auto-generates a self-signed certificate. **This is normal and expected.**

**Options:**

1. **Click through warning** (fastest, warning on every session)
2. **Trust certificate permanently** (see [docs/SECURITY.md](./SECURITY.md#local-https-setup))

**Note:** If you run `make clean` or `docker compose down -v`, Caddy regenerates the certificate.

### Attack Surface Minimization

**Development Architecture:**

```yaml
# docker-compose.yml

# ✅ GOOD: Database not exposed to host
db:
  # Database is internal-only (not exposed to host by default for security)
  # Use 'make db-connect' to access the database
  # ports:  # Commented out for security
  #   - '5432:5432'

# ✅ GOOD: API/Web use 'expose' (internal only)
api:
  expose:
    - '3000' # Accessible ONLY within Docker network

# ✅ GOOD: Only Caddy exposes ports
caddy:
  ports:
    - '80:80'
    - '443:443'
```

**Security Implications:**

| Attack Vector                    | Mitigation                                      |
| -------------------------------- | ----------------------------------------------- |
| Direct database connection       | Port not exposed to host (must use Docker exec) |
| Direct API access (bypass proxy) | API port not mapped to host                     |
| Direct Web access (bypass proxy) | Web port not mapped to host                     |
| Local network scanning           | Only Caddy ports visible (80/443)               |
| Unauthorized service access      | Docker network isolation                        |

### Production Parity

Development security architecture matches production:

| Layer             | Development                         | Production                |
| ----------------- | ----------------------------------- | ------------------------- |
| **Load Balancer** | Caddy (HTTPS, self-signed cert)     | AWS ALB (HTTPS, ACM cert) |
| **API**           | Internal Docker network (port 3000) | Private subnet (ECS task) |
| **Web**           | Internal Docker network (port 5173) | CloudFront + S3 (static)  |
| **Database**      | Internal Docker network (port 5432) | Private subnet (RDS)      |

Both use **reverse proxy + private networking** pattern for defense-in-depth.

---

## Test Environment

### Overview

Plinth provides a separate Docker Compose configuration for running tests in an isolated environment that matches CI exactly:

**File:** `docker-compose.test.yml`

**Key Differences from Development:**

| Aspect                | Development (`docker-compose.yml`) | Test (`docker-compose.test.yml`)           |
| --------------------- | ---------------------------------- | ------------------------------------------ |
| Database              | `plinth_dev` (port 5432)           | `plinth_test` (port 5433)                  |
| Credentials           | Custom (from `.env`)               | Hardcoded `postgres/postgres` (matches CI) |
| Volumes               | Named volumes (persisted)          | Named volumes (ephemeral, cleaned up)      |
| Services              | DB + Caddy + API + Web             | DB + API + Web (no Caddy)                  |
| Auto-start            | Yes (`up -d`)                      | No (run tests via `docker compose run`)    |
| Environment Variables | From `.env` files                  | Hardcoded in docker-compose.test.yml       |
| Network Isolation     | `plinth-network`                   | `plinth-test-network` (separate from dev)  |
| Purpose               | Development with hot-reload        | Clean-slate testing (matches CI)           |

### Architecture

```
┌─────────────────────────────────────────────────────┐
│ Test Environment (docker-compose.test.yml)          │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   DB Test   │  │  API Test   │  │  Web Test   │  │
│  │             │  │             │  │             │  │
│  │ PostgreSQL  │  │ Node 24     │  │ Node 24     │  │
│  │ :5433       │  │ Vitest      │  │ Vitest      │  │
│  │ plinth_test │◄─┤ Supertest   │  │ RTL + MSW   │  │
│  │             │  │             │  │             │  │
│  │ postgres/   │  │ Clean slate │  │ Clean slate │  │
│  │ postgres    │  │ migrations  │  │ no API dep  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                     │
│  Network: plinth-test-network (isolated from dev)   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Usage

**Quick Start:**

```bash
# Run all tests in isolated containers (matches CI)
make test-docker

# Run API tests only
make test-docker-api

# Run Web tests only
make test-docker-web

# Clean up test containers and volumes
make test-docker-clean
```

**Manual Usage:**

```bash
# Start test database
docker compose -f docker-compose.test.yml up -d db-test

# Run API tests
docker compose -f docker-compose.test.yml run --rm api-test sh -c "
  pnpm install --frozen-lockfile &&
  cd apps/api &&
  pnpm db:generate &&
  pnpm db:migrate:deploy &&
  pnpm test
"

# Run Web tests
docker compose -f docker-compose.test.yml run --rm web-test sh -c "
  pnpm install --frozen-lockfile &&
  cd apps/web &&
  pnpm test
"

# Clean up
docker compose -f docker-compose.test.yml down -v
```

### Environment Variables

Test environment uses **hardcoded credentials** to match CI (defined in `docker-compose.test.yml`):

```yaml
# API Test Container Environment
DATABASE_URL: postgresql://postgres:postgres@db-test:5432/plinth_test
JWT_SECRET: test-secret-key-for-ci-must-be-at-least-32-chars-long
JWT_REFRESH_SECRET: test-refresh-secret-key-for-ci-must-be-32-chars
APP_URL: http://localhost:5173
API_URL: http://localhost:3000
NODE_ENV: test
```

**No `.env.test` file needed** — all config is in `docker-compose.test.yml` for reproducibility.

### Why Separate Test Environment?

**1. Isolation from Development Database:**

- Dev database: `plinth_dev` on port 5432
- Test database: `plinth_test` on port 5433
- No risk of wiping dev data during tests

**2. Matches CI Exactly:**

- Same database credentials (`postgres/postgres`)
- Same environment variables
- Same PostgreSQL version (15-alpine)
- Same migration flow

**3. Clean-Slate Testing:**

- Each test run starts fresh
- No leftover data from previous runs
- Volumes cleaned up with `docker compose down -v`

**4. Parallel Execution:**

- Dev environment and test environment can run simultaneously
- Different networks prevent port conflicts
- Different databases prevent data conflicts

### Workflow Integration

**During Development:**

```bash
# Terminal 1: Run dev environment
make dev

# Terminal 2: Run tests in isolation (doesn't affect dev)
make test-docker-api

# Dev environment still running, unaffected
```

**Before Creating PR:**

```bash
# Run tests in isolated environment (matches CI)
make test-docker

# If tests pass locally, they'll pass in CI
```

**Debugging Test Failures:**

```bash
# Start test database
docker compose -f docker-compose.test.yml up -d db-test

# Shell into test container for debugging
docker compose -f docker-compose.test.yml run --rm api-test sh

# Inside container:
pnpm install --frozen-lockfile
cd apps/api
pnpm db:generate
pnpm db:migrate:deploy
pnpm test --reporter=verbose

# Clean up when done
docker compose -f docker-compose.test.yml down -v
```

### Comparison to CI

**GitHub Actions CI** (uses GitHub services):

```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: plinth_test
    ports:
      - 5432:5432

steps:
  - run: pnpm install --frozen-lockfile
  - run: pnpm --filter api db:generate
  - run: pnpm --filter api db:migrate:deploy
  - run: pnpm --filter api test
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/plinth_test
      JWT_SECRET: test-secret-key-for-ci-must-be-at-least-32-chars-long
      # ... (same env vars)
```

**Local Test Environment** (`docker-compose.test.yml`):

- ✅ Same PostgreSQL version (15-alpine)
- ✅ Same credentials (`postgres/postgres`)
- ✅ Same database name (`plinth_test`)
- ✅ Same environment variables
- ✅ Same migration flow
- ✅ Same test commands

**Result:** If tests pass locally with `make test-docker`, they'll pass in CI.

### Cleanup

**After Tests:**

```bash
# Stop containers and remove volumes
make test-docker-clean

# Equivalent to:
docker compose -f docker-compose.test.yml down -v --remove-orphans
```

**What Gets Cleaned:**

- ✅ Test database container (`db-test`)
- ✅ Test database volume (`postgres-test-data`)
- ✅ Test node_modules volumes
- ✅ Test pnpm store volume
- ✅ Test network (`plinth-test-network`)

**What Stays:**

- ✅ Development database (untouched)
- ✅ Development containers (still running)
- ✅ Source code (volume-mounted, not copied)

### Architectural Decision: Why No `docker-compose.ci.yml`?

**Current Approach:** GitHub Actions uses GitHub-hosted services for CI testing (see [.github/workflows/ci.yml](.github/workflows/ci.yml)):

```yaml
# CI runs tests using GitHub Actions services
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: plinth_test
    ports:
      - 5432:5432

steps:
  - run: pnpm install --frozen-lockfile
  - run: pnpm --filter api db:migrate:deploy
  - run: pnpm --filter api test
```

**Why This Works for Plinth:**

✅ **Simple dependency tree** — Only PostgreSQL needed for tests
✅ **Fast CI execution** — GitHub Actions services start in parallel with checkout/setup
✅ **No registry coordination** — Fresh builds on every CI run, no image pushing/pulling
✅ **Low cognitive overhead** — Fewer moving parts for contributors to understand
✅ **Easy to maintain** — All CI config in one workflow file

**Alternative Approach: `docker-compose.ci.yml` (Not Used)**

Some projects use Docker Compose inside CI workflows:

```yaml
# Alternative approach (used by projects with complex dependencies)
- run: docker compose -f docker-compose.ci.yml run api test
```

**When `docker-compose.ci.yml` Makes Sense:**

🔧 **3+ service dependencies** — Redis, ElasticSearch, message queues, SFTP, etc.
🔧 **Registry-based images** — Pulling pre-built images from GHCR/ECR/Docker Hub
🔧 **Complex networking** — Service meshes, custom networks, inter-service communication
🔧 **Shared config** — Multiple CI workflows that need identical service configuration
🔧 **Environment parity** — Need to replicate exact CI environment locally with same images

**Why Plinth Doesn't Need It (Yet):**

❌ **Single database service** — GitHub Actions `services:` handles this cleanly
❌ **No image registry** — Not publishing/consuming images from GHCR
❌ **Simple networking** — API → PostgreSQL, no service mesh
❌ **No config duplication** — Only one test workflow currently

**Decision Rationale:**

The Docker Compose approach (orchestration via `docker-compose.ci.yml`) vs GitHub Actions services (simple service definition) is a trade-off:

| Aspect                     | GitHub Actions Services (Current) | docker-compose.ci.yml (Alternative)        |
| -------------------------- | --------------------------------- | ------------------------------------------ |
| **Best for**               | 1-2 simple dependencies           | 3+ complex dependencies                    |
| **CI execution speed**     | ⚡ Faster (parallel startup)      | 🐌 Slower (Docker Compose overhead)        |
| **Local replication**      | ✅ `docker-compose.test.yml`      | ✅ Exact same file (`docker-compose.ci`)   |
| **Configuration location** | GitHub workflow YAML              | Separate docker-compose.ci.yml file        |
| **Maintenance burden**     | ✅ Low (one file)                 | ⚠️ Higher (workflow + compose file)        |
| **Registry dependency**    | ❌ No                             | ⚠️ Often yes (pre-built images)            |
| **Learning curve**         | ✅ Lower (familiar to most devs)  | ⚠️ Higher (needs Docker Compose knowledge) |

**When to Revisit This Decision:**

Consider adding `docker-compose.ci.yml` if any of these become true:

1. **Adding Redis, ElasticSearch, RabbitMQ, or similar** — Multiple service dependencies make Docker Compose worthwhile
2. **Publishing images to GHCR** — If Plinth starts using `ghcr.io/plinth/api:latest` in CI
3. **Complex CI workflows** — If test config is duplicated across 3+ workflow files
4. **Service mesh requirements** — Custom networks, service discovery, health check orchestration
5. **CI config drift** — If GitHub Actions services and `docker-compose.test.yml` diverge significantly

**Current Status (2026-07-05):**

✅ **GitHub Actions services** for CI (simple, fast, working well)
✅ **docker-compose.test.yml** for local testing (replicates CI environment)
✅ **docker-compose.yml** for development (hot-reload, full stack)

This three-file approach balances simplicity (CI) with local testing capability (test.yml) and development ergonomics (dev).

**References:**

- Current CI workflow: [.github/workflows/ci.yml](../.github/workflows/ci.yml)
- Local test environment: [docker-compose.test.yml](../docker-compose.test.yml)
- Development environment: [docker-compose.yml](../docker-compose.yml)

---

## Production Builds

### Building Production Images

```bash
# Build both API and Web production images
make build

# Equivalent to:
docker compose build --target production api web
```

### Testing Production Images Locally

Create `docker-compose.prod.yml`:

```yaml
services:
  api:
    build:
      target: production
    environment:
      NODE_ENV: production
  web:
    build:
      target: production
```

Run:

```bash
docker compose -f docker-compose.prod.yml up
```

### Image Optimization

Production images are optimized for size and security:

| Optimization               | API Image           | Web Image            |
| -------------------------- | ------------------- | -------------------- |
| Base image                 | `node:24-alpine`    | `caddy:2.8-alpine`   |
| Dev dependencies excluded  | ✅ `--prod` install | ✅ Build stage only  |
| Source TypeScript excluded | ✅ Only built JS    | ✅ Only static files |
| Non-root user              | ✅ `nodejs:1001`    | ✅ `caddy` (default) |
| Health checks              | ✅ `/health`        | ✅ `/health`         |
| Multi-stage build          | ✅ 5 stages         | ✅ 5 stages          |

**Image Sizes:**

- Development: ~1.5GB (includes all deps, source, tools)
- Production API: ~250MB (runtime only)
- Production Web: ~20MB (static files + Caddy)

---

## Troubleshooting

### Container Won't Start

**Symptom:** `docker compose up` fails immediately

**Diagnosis:**

```bash
# View logs
make logs-api
make logs-web

# Check container status
docker compose ps

# Inspect specific container
docker compose logs api --tail 50
```

**Common Causes:**

1. **Port conflict:**

   ```
   Error: bind: address already in use (0.0.0.0:3000)
   ```

   Fix: Kill process using port or change port in `docker-compose.yml`

2. **Database not ready:**

   ```
   Error: Can't reach database server at db:5432
   ```

   Fix: Wait for database healthcheck, or run `make db-migrate`

3. **Missing environment variables:**
   ```
   ValidationError: JWT_SECRET is required
   ```
   Fix: Copy `.env.example` to `.env` and populate values

### Hot-Reload Not Working

**Symptom:** Code changes don't reflect in running container

**Diagnosis:**

```bash
# Verify volume mounts
docker compose config | grep volumes -A 5

# Check file is mounted
make shell-api
$ cat apps/api/src/routes/health.ts  # Should show your changes
```

**Common Causes:**

1. **File not saved:** Ensure file is actually saved on host
2. **Wrong file:** Editing file outside volume mount (e.g., root `node_modules`)
3. **Cache issue:** Rebuild with `make rebuild`

### Database Connection Refused

**Symptom:** `Error: connect ECONNREFUSED`

**Diagnosis:**

```bash
# Check database is running
docker compose ps db

# Test connection from API container
make shell-api
$ nc -zv db 5432  # Should connect
```

### Caddy Reverse Proxy Issues

**Symptom:** Cannot access `https://localhost` or `https://localhost/api/v1/health`

**Diagnosis:**

```bash
# Check Caddy is running
docker compose ps caddy

# View Caddy logs
docker compose logs caddy -f

# Check Caddy health (use -k to accept self-signed cert)
curl -k https://localhost

# Test API directly (should fail - not exposed)
curl http://localhost:3000/api/v1/health  # Should timeout/refuse
```

**Common Causes:**

1. **Caddy not started:**

   ```
   Error: connection refused on port 80
   ```

   Fix: `make dev` or `docker compose up caddy`

2. **Port 80 already in use:**

   ```
   Error: bind: address already in use (0.0.0.0:80)
   ```

   Fix: Stop other web servers (Apache, nginx, etc.) or change Caddy port

3. **Caddyfile.local syntax error:**

   ```
   Error: adapting config using caddyfile
   ```

   Fix: Check `Caddyfile.local` for typos, validate syntax

4. **API/Web containers not accessible:**

   ```
   Error: dial tcp: lookup api on 127.0.0.11:53: no such host
   ```

   Fix: Ensure API and Web containers are running on same network (`plinth-network`)

5. **Vite HMR WebSocket not working:**
   - Symptom: Frontend loads but hot-reload doesn't work
   - Fix: Caddy automatically proxies WebSocket, check browser console for errors
   - Ensure `host: '0.0.0.0'` is set in `apps/web/vite.config.ts`

**Testing Caddy Routing:**

```bash
# Test frontend (should return HTML, use -k to accept self-signed cert)
curl -k https://localhost

# Test API health endpoint (should return JSON)
curl -k https://localhost/api/v1/health

# Test API docs (should return HTML with Scalar UI)
curl -k https://localhost/docs

# View Caddy access logs in real-time
docker compose logs caddy -f
```

**Fixes:**

1. Ensure `DATABASE_URL` uses `db` hostname, not `localhost`
2. Wait for database health check: `docker compose up db` first
3. Check credentials match between `.env` and `apps/api/.env`

### Permission Denied Errors

**Symptom:** `EACCES: permission denied` when writing files

**Diagnosis:**

```bash
# Check file ownership
ls -la apps/api/

# Check container user
docker compose exec api whoami  # Should be 'root' in dev
```

**Fixes:**

1. **Development:** Containers run as root, should not have permission issues
2. **If issue persists:** Reset volumes with `make clean`, then `make dev`

### Slow Build Times

**Symptom:** `docker compose build` takes 5+ minutes

**Diagnosis:**

```bash
# Check build cache usage
docker system df

# Monitor build output
docker compose build --progress=plain api
```

**Optimizations:**

1. **Use BuildKit cache:**

   ```bash
   DOCKER_BUILDKIT=1 docker compose build
   ```

2. **Multi-stage builds:** Already implemented (dependency caching)

3. **Prune unused images:**
   ```bash
   docker image prune -a  # ⚠️  Removes all unused images
   ```

### Out of Disk Space

**Symptom:** `Error: no space left on device`

**Diagnosis:**

```bash
# Check Docker disk usage
docker system df
```

**Cleanup:**

```bash
# Remove stopped containers, unused networks, dangling images
docker system prune

# Remove volumes (⚠️  destroys databases!)
docker system prune --volumes

# Remove everything (⚠️  nuclear option!)
docker system prune -a --volumes
```

---

## Best Practices

### Development Workflow

1. **Start fresh each day:**

   ```bash
   make dev  # Ensures latest code, healthy DB
   ```

2. **Use shell access for debugging:**

   ```bash
   make shell-api
   $ pnpm --filter api test          # Run tests
   $ pnpm --filter api db:studio     # Open Prisma Studio
   ```

3. **View logs in separate terminal:**

   ```bash
   # Terminal 1: Run services
   make dev

   # Terminal 2: Watch API logs
   make logs-api
   ```

4. **Rebuild after dependency changes:**
   ```bash
   # Added new npm package
   make rebuild
   ```

### CI/CD Integration

GitHub Actions validates Docker builds on every PR:

```yaml
# .github/workflows/ci.yml
docker-build:
  steps:
    - uses: docker/build-push-action@v5
      with:
        file: docker/api.Dockerfile
        target: production
        cache-from: type=gha
        cache-to: type=gha,mode=max
```

**Benefits:**

- Catches Dockerfile errors early
- Validates production images build successfully
- Uses GitHub Actions cache for faster builds

### Security

1. **Non-root users in production:**

   ```dockerfile
   # Production stage runs as non-root
   USER nodejs:1001
   ```

2. **Health checks:**

   ```dockerfile
   HEALTHCHECK CMD curl -f http://localhost:3000/health || exit 1
   ```

3. **Minimal base images:**

   ```dockerfile
   FROM node:24-alpine  # ~150MB vs node:24 ~1GB
   ```

4. **No secrets in images:**
   - Environment variables passed at runtime
   - `.dockerignore` excludes `.env` files

### Performance

1. **Layer caching:**

   ```dockerfile
   # Copy package.json first (cached until dependencies change)
   COPY package.json pnpm-lock.yaml ./
   RUN pnpm install

   # Copy source code last (changes frequently)
   COPY apps/api ./apps/api
   ```

2. **BuildKit cache:**

   ```bash
   DOCKER_BUILDKIT=1 docker compose build
   ```

3. **Prune regularly:**
   ```bash
   docker system prune -f  # Remove dangling images/containers
   ```

---

## Next Steps

- [Makefile Documentation](./MAKEFILE.md) - Complete command reference
- [Deployment Guide](./DEPLOYMENT.md) - AWS ECS/Fargate deployment (coming soon)
- [OpenAPI Spec](../packages/openapi/openapi.yaml) - API documentation

**Questions?** Open an issue at [github.com/plinth/plinth/issues](https://github.com)
