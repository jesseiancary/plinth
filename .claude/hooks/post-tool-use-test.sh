#!/bin/bash
# PostToolUse hook: Run tests after file edits in test-worthy directories
#
# This hook implements Anthropic's #1 recommendation: "Give Claude a way to verify its work"
# It runs relevant tests automatically after file modifications to catch errors immediately.
#
# Triggered by: Write, Edit, NotebookEdit tools
# Exit codes: Always exits 0 (informational only, never blocks)

# Get the edited file path from the first argument
EDITED_FILE="$1"

# Exit early if no file path provided
if [[ -z "$EDITED_FILE" ]]; then
  exit 0
fi

# API backend files - run API tests
if [[ "$EDITED_FILE" =~ ^apps/api/src/ ]] && [[ ! "$EDITED_FILE" =~ \.test\. ]]; then
  echo "🧪 Running API tests to verify changes..."

  # Run tests silently, capturing exit code
  if pnpm --filter api test --silent 2>&1 | grep -E "(FAIL|Error|✓|✗)" | head -20; then
    echo "✅ Tests passed"
  else
    echo "⚠️  Some tests failed. Review failures above."
    echo "💡 Fix failing tests before committing."
  fi

  exit 0
fi

# Frontend files - run web tests
if [[ "$EDITED_FILE" =~ ^apps/web/src/ ]] && [[ ! "$EDITED_FILE" =~ \.test\. ]]; then
  echo "🧪 Running web tests to verify changes..."

  # Run tests silently, capturing exit code
  if pnpm --filter web test --silent 2>&1 | grep -E "(FAIL|Error|✓|✗)" | head -20; then
    echo "✅ Tests passed"
  else
    echo "⚠️  Some tests failed. Review failures above."
    echo "💡 Fix failing tests before committing."
  fi

  exit 0
fi

# Prisma schema changes - suggest running migrations
if [[ "$EDITED_FILE" =~ prisma/schema\.prisma$ ]]; then
  echo "⚠️  Prisma schema modified. Remember to:"
  echo "   1. Create migration: pnpm --filter api db:migrate:dev --name <description>"
  echo "   2. Update seed data if needed: apps/api/prisma/seed.ts"
  echo "   3. Regenerate Prisma client (happens automatically with migration)"
  exit 0
fi

# OpenAPI spec changes - validate and suggest regenerating types
if [[ "$EDITED_FILE" =~ packages/openapi/openapi\.yaml$ ]]; then
  echo "📋 OpenAPI spec modified. Validating..."

  if pnpm --filter openapi validate 2>&1; then
    echo "✅ OpenAPI spec is valid"
    echo "💡 Remember to regenerate types: pnpm --filter openapi generate:types"
  else
    echo "⚠️  OpenAPI spec validation failed. Review errors above."
  fi

  exit 0
fi

# No specific action for this file type
exit 0
