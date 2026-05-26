#!/bin/bash
# Pre-edit hook: Validate TypeScript types before Claude makes changes

set -e

echo "Running type check before edit..."

# Run TypeScript compiler in check mode
pnpm typecheck --silent 2>&1 || {
  echo "⚠️  Type errors detected. Claude will proceed but may need to fix type issues."
  exit 0  # Don't block the edit, just warn
}

echo "✅ Type check passed"
exit 0
