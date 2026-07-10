# Node.js 26 Features & Upgrade Guide

> **Upgrade Date:** 2026-07-09
> **Previous Version:** Node.js 24
> **Current Version:** Node.js 26.5.0

---

## Overview

This document outlines Node.js 26 features available in the Plinth codebase, including implemented enhancements and future opportunities.

---

## Implemented Features

### 1. UUIDv7 (Time-Ordered UUIDs) ✅

**What is UUIDv7?**

- Time-ordered, sortable UUIDs with millisecond-precision timestamps
- Monotonically increasing within the same millisecond
- Better B-tree indexing performance for databases
- RFC 9562 compliant

**Implementation:**

- **Location:** [apps/api/src/lib/crypto.ts](../apps/api/src/lib/crypto.ts)
- **API:** `crypto.randomUUID({ version: 7 })`
- **Use Cases:**
  - API key generation ([apps/api/src/lib/api-key.ts](../apps/api/src/lib/api-key.ts))
  - Invitation token generation ([apps/api/src/lib/crypto.ts](../apps/api/src/lib/crypto.ts))

**Benefits:**

- **Database Performance:** UUIDv7 sorts by creation time, reducing B-tree fragmentation
- **Query Optimization:** Time-based range queries work efficiently
- **Observability:** Timestamps embedded in IDs help with debugging

**Example:**

```typescript
import { generateUUIDv7 } from './lib/crypto.js'

const uuid = generateUUIDv7()
// "018e5d7d-6b9e-7000-8000-123456789abc"
//  ^^^^^^^^^^^^^^^
//  Timestamp (milliseconds since Unix epoch)
```

**Format Comparison:**

```
UUIDv4 (random):  f47ac10b-58cc-4372-a567-0e02b2c3d479
UUIDv7 (ordered): 018e5d7d-6b9e-7000-8000-123456789abc
                  ^^^^^^^^ ^^^^ ^^^^
                  timestamp     random
```

---

## Available Features (Not Yet Implemented)

### 2. Map/WeakMap Upsert Methods

**What are upsert methods?**

- `Map.prototype.getOrInsert(key, value)` - Insert if missing, return existing if present
- `Map.prototype.getOrInsertComputed(key, callback)` - Insert computed value if missing

**Potential Use Cases:**

- **Rate Limiting:** Cache rate limit counters per IP/user
- **Session Storage:** Store session data with auto-initialization
- **Query Caching:** Cache Prisma query results with automatic initialization

**Example (Future):**

```typescript
// Current pattern (verbose)
const cache = new Map<string, number>()
const value =
  cache.get(key) ??
  (() => {
    cache.set(key, 0)
    return 0
  })()

// Node 26 pattern (concise)
const value = cache.getOrInsert(key, 0)
```

**Status:** 🔵 Not implemented (no immediate use case)

---

### 3. IncomingMessage.signal (AbortSignal)

**What is req.signal?**

- Automatic `AbortSignal` attached to HTTP requests
- Signals when client disconnects or request is cancelled
- Standard Web API for cancellation

**Potential Use Cases:**

- **Long-Running Queries:** Abort Prisma queries when client disconnects
- **File Uploads:** Cancel S3 uploads if request is interrupted
- **Background Jobs:** Stop job processing if request is cancelled

**Example (Future):**

```typescript
router.get('/heavy-query', async (req, res) => {
  // Prisma query that respects request cancellation
  const results = await prisma.user.findMany({
    // Pass AbortSignal to abort query if client disconnects
    // Note: Prisma doesn't support this yet, but could in future
  })

  // Alternative: Manual cancellation handling
  req.signal.addEventListener('abort', () => {
    console.log('Client disconnected, cleaning up...')
  })

  res.json(results)
})
```

**Status:** 🔵 Not implemented (waiting for Prisma/library support)

---

### 4. Temporal API (Modern Date/Time)

**What is Temporal?**

- Modern replacement for JavaScript's `Date` object
- Immutable, type-safe, time-zone aware by default
- RFC 3339 compliant

**Potential Use Cases:**

- **JWT Expiry Calculations:** Replace manual timestamp math
- **Invitation Expiry:** Type-safe date comparisons
- **Subscription Billing:** Accurate time-zone handling for invoices

**Example (Future):**

```typescript
// Current pattern (Date object)
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
if (invitation.expiresAt < new Date()) {
  // Expired
}

// Temporal pattern (more readable)
import { Temporal } from '@js-temporal/polyfill' // or use global Temporal in Node 26
const expiresAt = Temporal.Now.instant().add({ days: 7 })
if (Temporal.Instant.compare(invitation.expiresAt, Temporal.Now.instant()) < 0) {
  // Expired
}
```

**Migration Strategy:**

1. **Phase 1 (Current):** Continue using `Date` for compatibility
2. **Phase 2 (Future):** Introduce Temporal for new code (JWT expiry, billing)
3. **Phase 3 (Long-term):** Migrate existing code incrementally

**Status:** 🟡 Available but not adopted (requires migration strategy)

---

### 5. Iterator.concat()

**What is Iterator.concat()?**

- Lazily chain multiple iterables without intermediate arrays
- Memory-efficient for large datasets

**Potential Use Cases:**

- **Pagination:** Combine multiple API pages into single iterator
- **Multi-Source Queries:** Merge results from multiple Prisma queries
- **CSV Export:** Stream data from multiple sources

**Example (Future):**

```typescript
// Current pattern (builds intermediate arrays)
const allResults = [...page1Results, ...page2Results, ...page3Results]

// Iterator.concat (lazy, memory-efficient)
const allResults = Iterator.concat(page1Results, page2Results, page3Results)
for (const item of allResults) {
  // Process without loading everything into memory
}
```

**Status:** 🔵 Not implemented (no immediate use case)

---

### 6. HTTP res.writeInformation() (1xx Informational Responses)

**What is res.writeInformation()?**

- Send arbitrary 1xx informational responses (e.g., 103 Early Hints)
- Improves page load performance by preloading resources

**Potential Use Cases:**

- **Early Hints (103):** Preload CSS/JS assets before HTML response
- **Progressive Responses:** Stream partial results while query runs

**Example (Future):**

```typescript
router.get('/dashboard', async (req, res) => {
  // Send 103 Early Hints to preload critical assets
  res.writeInformation(103, {
    Link: '</styles.css>; rel=preload; as=style',
  })

  // Continue processing request
  const data = await loadDashboardData()
  res.json(data)
})
```

**Status:** 🔵 Not implemented (low priority for API-first app)

---

## Breaking Changes in Node 26

### 1. Legacy Stream Modules Removed

The following internal modules were removed:

- `_stream_wrap`
- `_stream_readable`
- `_stream_writable`
- `_stream_duplex`
- `_stream_transform`
- `_stream_passthrough`

**Impact:** ✅ None (we don't use internal modules)

### 2. http.Server.prototype.writeHeader() Removed

**Impact:** ✅ None (we use `writeHead()`)

---

## V8 Engine Update (14.6.202.33)

Node.js 26 includes V8 from Chromium 134, bringing:

- **Performance Improvements:** Faster JavaScript execution
- **Memory Optimizations:** Reduced memory footprint
- **New Language Features:** Map upsert, Iterator.concat (see above)

---

## Dependencies Compatibility

All current dependencies are compatible with Node.js 26:

| Dependency     | Node 26 Support | Notes                   |
| -------------- | --------------- | ----------------------- |
| Prisma 5.22    | ✅ Yes          | Tested and working      |
| Express 5.2    | ✅ Yes          | Stable on Node 26       |
| Vite 8.1       | ✅ Yes          | Full support            |
| Vitest 4.1     | ✅ Yes          | All tests passing       |
| TypeScript 6.0 | ✅ Yes          | Node 26 types available |

---

## Future Enhancements Roadmap

### Phase 6 (AI Integration Showcase)

- ✅ UUIDv7 for API keys/tokens (implemented)
- 🔵 Document Temporal API migration path

### Phase 7+ (Future Phases)

- 🔵 Evaluate `req.signal` for long-running queries
- 🔵 Consider Map.getOrInsert() for caching layer
- 🔵 Explore 103 Early Hints for frontend performance

---

## References

- [Node.js 26 Release Notes](https://nodejs.org/en/blog/release/v26.0.0/)
- [What's new in Node.js 26](https://nodejsdesignpatterns.com/blog/whats-new-in-nodejs-26/)
- [Node.js v26 Changelog](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V26.md)
- [UUIDv7 RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html)
- [Temporal API Documentation](https://tc39.es/proposal-temporal/docs/)

---

## Testing Strategy

**Validation Steps:**

1. ✅ Docker images rebuilt with Node 26
2. ✅ CI pipeline updated (all 6 jobs)
3. ⏳ Integration tests (run via `make test-docker`)
4. ⏳ Production smoke test (build + basic functionality)

**Rollback Plan:**

```bash
git checkout main
make rebuild
```

---

**Last Updated:** 2026-07-09
**Maintained By:** Plinth Development Team
